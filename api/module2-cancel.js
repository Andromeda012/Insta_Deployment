import {authenticateModule2Admin,supabaseAdminRequest,sendApiError} from './_lib/module2-publishing.js';
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
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed.'});}
 try{
  await authenticateModule2Admin(req);const id=String(req.body?.queue_task_id||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({ok:false,error:'Geçerli queue_task_id gerekli.'});
  const updated=await supabaseAdminRequest(`/rest/v1/social_publish_queue?id=eq.${encodeURIComponent(id)}&status=eq.pending`,{
   method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'cancelled',error_message:'Cancelled by an authorized Module 2 administrator.',updated_at:new Date().toISOString()})
  });
  if(Array.isArray(updated)&&updated.length){
   try{await removePanelQueueItem(updated[0]);}catch(syncError){console.error('[Module 2 cancel] Panel sync warning:',syncError);}
   return res.status(200).json({ok:true,cancelled:true,queue_task_id:id,status:'cancelled'});
  }
  const current=await supabaseAdminRequest(`/rest/v1/social_publish_queue?id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`);
  return res.status(409).json({ok:false,cancelled:false,status:current?.[0]?.status||'not_found',error:'Yayın artık pending durumda değil; güvenli şekilde iptal edilemedi.'});
 }catch(e){return sendApiError(res,e,'Module 2 cancel');}
}
