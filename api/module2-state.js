import {authenticateModule2Admin,supabaseAdminRequest,sendApiError} from './_lib/module2-publishing.js';
const ALLOWED=new Set(['insta_bot_state','fb_bot_state','tt_bot_state','yt_bot_state','instagram_published_tracker']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({ok:false,error:'Method not allowed.'});}
 try{
  await authenticateModule2Admin(req);
  if(req.method==='GET'){
   const key=String(req.query?.key||new URL(req.url,'https://local.invalid').searchParams.get('key')||'');
   if(!ALLOWED.has(key))return res.status(400).json({ok:false,error:'Unsupported Module 2 state key.'});
   const rows=await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}&select=data,updated_at&limit=1`);
   return res.status(200).json({ok:true,key,data:rows?.[0]?.data??null,updated_at:rows?.[0]?.updated_at??null});
  }
  const b=req.body||{},key=String(b.key||''),data=b.data;
  if(!ALLOWED.has(key))return res.status(400).json({ok:false,error:'Unsupported Module 2 state key.'});
  if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({ok:false,error:'State data must be a JSON object.'});
  if(Buffer.byteLength(JSON.stringify(data),'utf8')>750000)return res.status(413).json({ok:false,error:'State payload is too large.'});
  await supabaseAdminRequest('/rest/v1/site_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,data,updated_at:new Date().toISOString()})});
  return res.status(200).json({ok:true,key,saved:true});
 }catch(e){return sendApiError(res,e,'Module 2 state');}
}