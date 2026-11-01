import {createHash} from 'node:crypto';
import {authenticateModule2Admin,authorizeVercelCron,supabaseAdminRequest,sendApiError} from './_lib/module2-publishing.js';

const STATE_KEYS=new Set(['insta_bot_state','fb_bot_state','tt_bot_state','yt_bot_state','instagram_published_tracker']);
const ALLOWED_TYPES={instagram:new Set(['POST','REELS','STORIES']),facebook:new Set(['PHOTO_POST','FB_STORIES','LINK_CARD']),tiktok:new Set(['TIKTOK_VIDEO','TIKTOK_PHOTO_CAROUSEL'])};
function validHttpsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&value.length<=2048;}catch{return false;}}
function actionOf(req){return String(req.query?.action||new URL(req.url,'https://local.invalid').searchParams.get('action')||'').toLowerCase();}

async function syncPanelQueue(task,payload){
 if(!task?.id)return;
 const map={instagram:['insta_bot_state','scheduled_posts'],facebook:['fb_bot_state','scheduled_posts'],tiktok:['tt_bot_state','scheduledQueue']};
 const target=map[payload.platform];if(!target)return;
 const[key,listKey]=target;
 const rows=await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${key}&select=data&limit=1`);
 const state=rows?.[0]?.data||{config:{},[listKey]:[]};
 const list=Array.isArray(state[listKey])?state[listKey]:[];
 const common={queue_task_id:task.id,queue_idempotency_key:payload.idempotency_key,idempotency_key:payload.idempotency_key,content_type:payload.content_type,media_url:payload.media_url,scheduled_for:task.scheduled_for||payload.scheduled_for,status:task.status||'pending',product_slug:payload.product_slug||null,caption:payload.caption||'',hashtags:payload.hashtags||''};
 const item=payload.platform==='tiktok'
  ?{...common,id:`tt_queue_${task.id}`,format:payload.content_type,productSku:payload.product_sku||'',productTitle:payload.title||'TikTok içeriği',mediaUrl:payload.media_url}
  :{...common,id:task.id,media_type:payload.content_type,title:payload.title||`${payload.platform} içeriği`,target_link:payload.target_link||null};
 const index=list.findIndex(p=>p.queue_task_id===task.id||p.queue_idempotency_key===payload.idempotency_key||p.idempotency_key===payload.idempotency_key);
 if(index>=0)list[index]={...list[index],...item};else list.unshift(item);
 state[listKey]=list.slice(0,60);
 await supabaseAdminRequest('/rest/v1/site_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,data:state,updated_at:new Date().toISOString()})});
}

async function removePanelQueueItem(task){
 const map={instagram:['insta_bot_state','scheduled_posts'],facebook:['fb_bot_state','scheduled_posts'],tiktok:['tt_bot_state','scheduledQueue']};
 const target=map[task.platform];if(!target)return;
 const[key,listKey]=target;
 const rows=await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${key}&select=data&limit=1`);
 if(!rows?.[0]?.data)return;
 const state=rows[0].data;const items=Array.isArray(state[listKey])?state[listKey]:[];
 state[listKey]=items.filter(p=>p.queue_task_id!==task.id&&p.queue_idempotency_key!==task.idempotency_key&&p.idempotency_key!==task.idempotency_key);
 await supabaseAdminRequest('/rest/v1/site_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,data:state,updated_at:new Date().toISOString()})});
}

async function handleState(req,res){
 if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({ok:false,error:'Method not allowed.'});}
 await authenticateModule2Admin(req);
 if(req.method==='GET'){
  const key=String(req.query?.key||new URL(req.url,'https://local.invalid').searchParams.get('key')||'');
  if(!STATE_KEYS.has(key))return res.status(400).json({ok:false,error:'Unsupported Module 2 state key.'});
  const rows=await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}&select=data,updated_at&limit=1`);
  return res.status(200).json({ok:true,key,data:rows?.[0]?.data??null,updated_at:rows?.[0]?.updated_at??null});
 }
 const b=req.body||{},key=String(b.key||''),data=b.data;
 if(!STATE_KEYS.has(key))return res.status(400).json({ok:false,error:'Unsupported Module 2 state key.'});
 if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({ok:false,error:'State data must be a JSON object.'});
 if(Buffer.byteLength(JSON.stringify(data),'utf8')>750000)return res.status(413).json({ok:false,error:'State payload is too large.'});
 await supabaseAdminRequest('/rest/v1/site_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,data,updated_at:new Date().toISOString()})});
 return res.status(200).json({ok:true,key,saved:true});
}

async function handleEnqueue(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed.'});}
 await authenticateModule2Admin(req);
 const b=req.body||{},platform=String(b.platform||'').toLowerCase(),contentType=String(b.content_type||'').toUpperCase();
 const mediaUrl=String(b.media_url||'').trim(),caption=String(b.caption||''),hashtags=String(b.hashtags||'');
 const scheduledFor=new Date(b.scheduled_for||Date.now()),targetLink=b.target_link?String(b.target_link).trim():null;
 if(!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES,platform)||!ALLOWED_TYPES[platform].has(contentType))return res.status(400).json({ok:false,error:'Bu platform/içerik türü yayın kuyruğunda desteklenmiyor.'});
 if(!validHttpsUrl(mediaUrl))return res.status(400).json({ok:false,error:'Medya adresi geçerli bir HTTPS URL olmalıdır.'});
 if(targetLink&&!validHttpsUrl(targetLink))return res.status(400).json({ok:false,error:'Hedef bağlantı geçerli bir HTTPS URL olmalıdır.'});
 if(platform==='facebook'&&contentType==='LINK_CARD'&&!targetLink)return res.status(400).json({ok:false,error:'Facebook Link Card için hedef bağlantı zorunludur.'});
 if(caption.length>5000||hashtags.length>1500)return res.status(413).json({ok:false,error:'Açıklama veya hashtag alanı izin verilen uzunluğu aşıyor.'});
 if(Number.isNaN(scheduledFor.getTime())||scheduledFor.getTime()>Date.now()+180*86400000)return res.status(400).json({ok:false,error:'Yayın zamanı geçersiz veya çok ileri bir tarih.'});
 const identity=[platform,contentType,mediaUrl,scheduledFor.toISOString().slice(0,16),String(b.product_slug||''),caption,hashtags,targetLink||''].join('|');
 const idempotencyKey=`manual_${platform}_${createHash('sha256').update(identity).digest('hex')}`;
 const payload={platform,content_type:contentType,slot_label:String(b.slot_label||'Manuel yayın').slice(0,64),product_slug:b.product_slug?String(b.product_slug).slice(0,180):null,media_url:mediaUrl,caption,hashtags,target_link:targetLink,status:'pending',idempotency_key:idempotencyKey,scheduled_for:scheduledFor.toISOString()};
 const inserted=await supabaseAdminRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(payload)});
 let task=Array.isArray(inserted)?inserted[0]:null,duplicate=false;
 if(!task){duplicate=true;const rows=await supabaseAdminRequest(`/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for,platform&limit=1`);task=rows?.[0]||null;}
 if(!task)throw new Error('Queue task could not be confirmed.');
 await syncPanelQueue(task,{...payload,title:String(b.title||'').slice(0,180),product_sku:b.product_sku||null,idempotency_key:idempotencyKey});
 return res.status(duplicate?200:201).json({ok:true,queued:true,duplicate_prevented:duplicate,queue_task_id:task.id,idempotency_key:idempotencyKey,status:task.status||'pending',scheduled_for:task.scheduled_for||scheduledFor.toISOString()});
}

async function handleCancel(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed.'});}
 await authenticateModule2Admin(req);
 const id=String(req.body?.queue_task_id||'').trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return res.status(400).json({ok:false,error:'Geçerli queue_task_id gerekli.'});
 const updated=await supabaseAdminRequest(`/rest/v1/social_publish_queue?id=eq.${encodeURIComponent(id)}&status=eq.pending`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'cancelled',error_message:'Cancelled by an authorized Module 2 administrator.',updated_at:new Date().toISOString()})});
 if(Array.isArray(updated)&&updated.length){
  try{await removePanelQueueItem(updated[0]);}catch(syncError){console.error('[Module 2 cancel] Panel sync warning:',syncError);}
  return res.status(200).json({ok:true,cancelled:true,queue_task_id:id,status:'cancelled'});
 }
 const current=await supabaseAdminRequest(`/rest/v1/social_publish_queue?id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`);
 return res.status(409).json({ok:false,cancelled:false,status:current?.[0]?.status||'not_found',error:'Yayın artık pending durumda değil; güvenli şekilde iptal edilemedi.'});
}

async function handleYoutubeCron(req,res){
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false});}
 if(req.method==='GET'){
  if(!authorizeVercelCron(req))return res.status(401).json({ok:false});
 }else await authenticateModule2Admin(req);
 return res.status(501).json({ok:false,supported:false,status:'unsupported',error:'YouTube Shorts resumable video upload is not implemented; drafts only.'});
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 const action=actionOf(req);
 try{
  if(action==='state')return await handleState(req,res);
  if(action==='enqueue')return await handleEnqueue(req,res);
  if(action==='cancel')return await handleCancel(req,res);
  if(action==='youtube-cron')return await handleYoutubeCron(req,res);
  return res.status(400).json({ok:false,error:'Unknown Module 2 action.'});
 }catch(e){return sendApiError(res,e,`Module 2 ${action||'API'}`);}
}
