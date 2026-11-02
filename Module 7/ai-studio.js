/* Module 7 — AI Studio profile editor. API keys are never handled in this browser module. */
(() => {
  const API = '/api/module7';
  const fields = [
    ['lighting', 'Işıklandırma', 'Örn. doğal gün ışığı, yumuşak spot'],
    ['atmosphere', 'Atmosfer / Duygu', 'Örn. sakin, premium, sıcak'],
    ['palette', 'Renk paleti', 'Örn. koyu grej, doğal meşe, krem'],
    ['decor', 'Dekor ve aksesuar', 'Örn. seramik vazo, zeytin dalı'],
    ['camera', 'Kamera / Kadraj', 'Örn. önden, 3/4 açı, geniş kadraj'],
    ['music', 'Müzik tercihi (Reels)', 'Örn. soft jazz; görsel üretimine gönderilmez']
  ];
  let products = [], profiles = { categories: {}, products: {} }, selected = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function token() {
    try {
      for (let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i);
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const raw=JSON.parse(localStorage.getItem(key)||'{}');
        if (raw.access_token) return raw.access_token;
      }
    } catch {}
    return '';
  }
  async function request(url, options={}) {
    const headers = { 'Content-Type':'application/json', ...(options.headers||{}) };
    const access = token();
    if (access) headers.Authorization = 'Bearer ' + access;
    const response = await fetch(url, { ...options, headers, cache:'no-store' });
    const body = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(body.error || 'İstek tamamlanamadı.');
    return body;
  }
  function mount() {
    if (document.getElementById('gm-ai-studio-launch')) return;
    const style=document.createElement('style');
    style.textContent=`
      #gm-ai-studio-launch{margin-left:8px;border:1px solid #b98a2e;background:linear-gradient(135deg,#d4af37,#9b7220);color:#101827;padding:9px 13px;border-radius:9px;font-weight:800;cursor:pointer}
      #gm-ai-studio{position:fixed;inset:0;z-index:1000010;background:rgba(3,8,18,.82);backdrop-filter:blur(9px);display:none;align-items:center;justify-content:center;padding:20px}
      #gm-ai-studio.open{display:flex}.gm-ai-card{width:min(920px,100%);max-height:92vh;overflow:auto;background:#111b2e;border:1px solid #334155;border-radius:18px;color:#e5e7eb;padding:24px;box-shadow:0 30px 90px #0009}
      .gm-ai-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}.gm-ai-head h2{font-size:21px}.gm-ai-muted{color:#94a3b8;font-size:12px;line-height:1.6}
      .gm-ai-tabs{display:flex;gap:8px;margin:18px 0;flex-wrap:wrap}.gm-ai-tabs button,.gm-ai-actions button{padding:9px 13px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;cursor:pointer;font-weight:700}
      .gm-ai-tabs button.active,.gm-ai-actions .primary{background:#d4af37;color:#111827;border-color:#d4af37}
      .gm-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.gm-ai-field label{display:block;font-size:11px;font-weight:800;color:#cbd5e1;margin-bottom:6px}.gm-ai-field input,.gm-ai-field select{width:100%;padding:11px;border-radius:8px;background:#090f1c;border:1px solid #334155;color:#f8fafc;font:inherit}
      .gm-ai-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.gm-ai-status{margin-top:12px;min-height:20px;color:#a7f3d0;font-size:12px}.gm-ai-note{margin-top:14px;padding:12px;border:1px solid #475569;border-radius:10px;background:#0b1424;font-size:12px;color:#cbd5e1;line-height:1.6}
      @media(max-width:650px){.gm-ai-grid{grid-template-columns:1fr}#gm-ai-studio{padding:8px}.gm-ai-card{padding:16px}}
    `;
    document.head.appendChild(style);
    const btn=document.createElement('button');btn.id='gm-ai-studio-launch';btn.type='button';btn.textContent='✨ AI Studio';
    const header=document.querySelector('.catalog-header > div:last-child') || document.querySelector('.catalog-header');
    header?.appendChild(btn);
    const modal=document.createElement('div');modal.id='gm-ai-studio';
    modal.innerHTML=`<section class="gm-ai-card" role="dialog" aria-modal="true" aria-labelledby="gm-ai-title">
      <div class="gm-ai-head"><div><h2 id="gm-ai-title">✨ AI Studio — Ürün Sahne Profilleri</h2><p class="gm-ai-muted">Kategori varsayılanlarını ve ürün bazlı özel ayarları yönetin.</p></div><button id="gm-ai-close" aria-label="Kapat" style="background:none;border:0;color:#fff;font-size:26px;cursor:pointer">×</button></div>
      <div class="gm-ai-tabs"><button data-mode="category" class="active">Kategori varsayılanı</button><button data-mode="product">Ürüne özel ayar</button></div>
      <div class="gm-ai-field" style="margin-bottom:13px"><label id="gm-ai-target-label">ÜRÜN KATEGORİSİ</label><select id="gm-ai-target"></select></div>
      <div class="gm-ai-grid" id="gm-ai-fields"></div>
      <div class="gm-ai-note"><strong>Ana prompt korunur.</strong> Buradaki değerler ana prompt'un yerine geçmez; üretim sırasında ek bağlam olarak birleştirilir. Müzik tercihi yalnızca Reels/video aşamasına aktarılır, görsel modeline gönderilmez. API anahtarları bu arayüzde tutulmaz.</div>
      <div class="gm-ai-actions"><button id="gm-ai-reset">Varsayılanları Yükle</button><button class="primary" id="gm-ai-save">Profili Kaydet</button></div>
      <div class="gm-ai-status" id="gm-ai-status" role="status"></div>
    </section>`;
    document.body.appendChild(modal);
    btn.addEventListener('click',open);
    modal.querySelector('#gm-ai-close').addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
    modal.querySelector('#gm-ai-target').addEventListener('change',loadForm);
    modal.querySelector('#gm-ai-reset').addEventListener('click',()=>{renderFields({});status('Form temizlendi. Henüz kaydedilmedi.');});
    modal.querySelector('#gm-ai-save').addEventListener('click',save);
    renderFields({});
  }
  function status(message,error=false){const el=document.getElementById('gm-ai-status');if(el){el.textContent=message;el.style.color=error?'#fca5a5':'#a7f3d0';}}
  function close(){document.getElementById('gm-ai-studio')?.classList.remove('open');}
  async function open(){
    document.getElementById('gm-ai-studio')?.classList.add('open');status('Ürünler ve kayıtlı profiller yükleniyor…');
    try{
      const [p,s]=await Promise.all([request(API+'?action=products'),request(API+'?action=ai-profiles')]);
      products=p.products||[];profiles=s.profiles||{categories:{},products:{}};
      const cats=[...new Set(products.map(x=>x.kategori||'Genel').filter(Boolean))];
      const select=document.getElementById('gm-ai-target');
      select.innerHTML=(mode==='category'?cats.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>'):products.map(x=>'<option value="'+esc(x.slug)+'">'+esc(x.title)+' · '+esc(x.kategori||'Genel')+'</option>')).join('');
      if(!select.options.length)select.innerHTML='<option value="">Kayıt bulunamadı</option>';
      loadForm();status('Profiller yüklendi.');
    }catch(e){status(e.message,true);}
  }
  let mode='category';
  function setMode(next){mode=next;document.querySelectorAll('#gm-ai-studio [data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.getElementById('gm-ai-target-label').textContent=mode==='category'?'ÜRÜN KATEGORİSİ':'ÜRÜN';const select=document.getElementById('gm-ai-target');const cats=[...new Set(products.map(x=>x.kategori||'Genel'))];select.innerHTML=(mode==='category'?cats.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>'):products.map(x=>'<option value="'+esc(x.slug)+'">'+esc(x.title)+' · '+esc(x.kategori||'Genel')+'</option>')).join('');loadForm();}
  function renderFields(values){document.getElementById('gm-ai-fields').innerHTML=fields.map(([key,label,placeholder])=>'<div class="gm-ai-field"><label for="gm-ai-'+key+'">'+label.toUpperCase()+'</label><input id="gm-ai-'+key+'" maxlength="500" value="'+esc(values[key]||'')+'" placeholder="'+esc(placeholder)+'"></div>').join('');}
  function currentTarget(){return document.getElementById('gm-ai-target').value;}
  function loadForm(){const key=currentTarget();const value=mode==='category'?(profiles.categories[key]||{}):(profiles.products[key]||{});renderFields(value);}
  function formValue(){return Object.fromEntries(fields.map(([key])=>[key,document.getElementById('gm-ai-'+key).value.trim()]));}
  async function save(){
    const key=currentTarget();if(!key)return status('Önce bir kategori veya ürün seçin.',true);
    const value=formValue();
    if(mode==='category')profiles.categories[key]=value;else profiles.products[key]=value;
    const button=document.getElementById('gm-ai-save');button.disabled=true;
    try{const result=await request(API+'?action=ai-profiles',{method:'PUT',body:JSON.stringify({profiles})});profiles=result.profiles||profiles;status('AI Studio profili Supabase’e kaydedildi.');}
    catch(e){status(e.message,true);}
    finally{button.disabled=false;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();