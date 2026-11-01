import {createHash} from 'node:crypto';
import {authenticateModule2Admin,supabaseAdminRequest,sendApiError} from './_lib/module2-publishing.js';
const ALLOWED_TYPES={instagram:new Set(['POST','REELS','STORIES']),facebook:new Set(['PHOTO_POST','FB_STORIES','LINK_CARD']),tiktok:new Set(['TIKTOK_VIDEO','TIKTOK_PHOTO_CAROUSEL'])};
function validHttpsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&value.length<=2048;}catch{return false;}}
async function syncPanelQueue(task,payload){
 if(!task?.id)return;
 const map={instagram:['insta_bot_state','scheduled_posts'],facebook:['fb_bot_state','scheduled_posts'],tiktok:['tt_bot_state','scheduledQueue']};
 const target=map[payload.platform];if(!target)return;
 const[key,listKey]=target;
 const rows=await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${key}&select=data&limit=1`);
 const state=rows?.[0]?.data||{config:{},[listKey]:[]};
 const list=Array.isArray(state[listKey])?state[listKey]:[];
 const common={queue_task_id:task.id,queue_idempotency_key:payload.idempotency_key,idempotency_key:payload.idempotency_key,content_type:payload.content_type,media_url:payload.media_url,scheduled_for:task.scheduled_for||payload.scheduled_for,status:task.status||'pending',product_slug:payload.product_slug||null,caption:payload.caption||'',hashtags:payload.hashtags||''};
 let item;
 if(payload.platform==='tiktok')item={...common,id:`tt_queue_${task.id}`,format:payload.content_type,productSku:payload.product_sku||'',productTitle:payload.title||'TikTok içeriği',mediaUrl:payload.media_url};
 else item={...common,id:task.id,media_type:payload.content_type,title:payload.title||`${payload.platform} içeriği`,target_link:payload.target_link||null};
 const index=list.findIndex(p=>p.queue_task_id===task.id||p.queue_idempotency_key===payload.idempotency_key||p.idempotency_key===payload.idempotency_key);
 if(index>=0)list[index]={...list[index],...item};else list.unshift(item);
 state[listKey]=list.slice(0,60);
 await supabaseAdminRequest('/rest/v1/site_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,data:state,updated_at:new Date().toISOString()})});
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed.'});}
 try{
  await authenticateModule2Admin(req);const b=req.body||{};const platform=String(b.platform||'').toLowerCase();const contentType=String(b.content_type||'').toUpperCase();
  const mediaUrl=String(b.media_url||'').trim();const caption=String(b.caption||'');const hashtags=String(b.hashtags||'');const scheduledFor=new Date(b.scheduled_for||Date.now());const targetLink=b.target_link?String(b.target_link).trim():null;
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
  let task=Array.isArray(inserted)?inserted[0]:null;let duplicate=false;
  if(!task){duplicate=true;const rows=await supabaseAdminRequest(`/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for,platform&limit=1`);task=rows?.[0]||null;}
  if(!task)throw new Error('Queue task could not be confirmed.');
  await syncPanelQueue(task,{...payload,title:String(b.title||'').slice(0,180),product_sku:b.product_sku||null,idempotency_key:idempotencyKey});
  return res.status(duplicate?200:201).json({ok:true,queued:true,duplicate_prevented:duplicate,queue_task_id:task?.id||null,idempotency_key:idempotencyKey,status:task?.status||'pending',scheduled_for:task?.scheduled_for||scheduledFor.toISOString()});
 }catch(e){return sendApiError(res,e,'Module 2 enqueue');}
}
