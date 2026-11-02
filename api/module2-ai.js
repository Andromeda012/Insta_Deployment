import { authenticateRoles, apiError } from './_lib/auth.js';
import { buildGeminiBananaPrompt } from '../Module 2/gemini-banana-engine.js';

const BASE=(process.env.SUPABASE_URL||'').replace(/\\/+$/,'');
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
function fail(message,status=500){const e=new Error(message);e.status=status;return e;}
async function db(path){
  if(!BASE||!SERVICE)throw fail('Supabase server configuration is incomplete.',503);
  const r=await fetch(BASE+path,{headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE},cache:'no-store'});
  const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{}
  if(!r.ok)throw fail(data?.message||'Supabase read failed.',r.status>=500?502:400);
  return data;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed.'});}
    await authenticateRoles(req,['admin','content_manager']);
    const slug=String(req.body?.product_slug||'').trim();
    if(!/^[a-z0-9][a-z0-9-]{0,179}$/i.test(slug))return res.status(400).json({ok:false,error:'Geçerli ürün kodu gerekli.'});
    const products=await db('/rest/v1/products?slug=eq.'+encodeURIComponent(slug)+'&select=*&limit=1');
    const product=products?.[0];if(!product)return res.status(404).json({ok:false,error:'Ürün bulunamadı.'});
    const rows=await db('/rest/v1/site_settings?key=eq.ai_studio_profiles&select=data&limit=1');
    const all=rows?.[0]?.data||{categories:{},products:{}};
    const profile={...(all.categories?.[product.kategori||'Genel']||{}),...(all.products?.[slug]||{})};
    const prompt=buildGeminiBananaPrompt(product,profile);
    const campaign={
      season:String(req.body?.season||'').slice(0,500),
      audience:String(req.body?.audience||'').slice(0,500),
      notes:String(req.body?.notes||'').slice(0,1500),
      platform:String(req.body?.platform||'instagram').slice(0,30),
      format:String(req.body?.format||'1:1').slice(0,10)
    };
    return res.status(200).json({ok:true,product:{slug:product.slug,title:product.title,category:product.kategori,image:product.ana_resim},profile,campaign,prompt,api_ready:Boolean(process.env.GEMINI_API_KEY)});
  }catch(e){return apiError(res,e,'Module 2 AI Studio');}
}