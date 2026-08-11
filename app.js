export const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function economics(product) {
  const sell = safeNumber(product.sell);
  const landed = safeNumber(product.landed);
  const profit = sell / 1.21 - sell * .17 - sell * .08 - landed;
  return { profit, margin: sell ? profit / sell * 100 : 0 };
}

export function isBuyZone(product) {
  const { profit, margin } = economics(product);
  return safeNumber(product.score) >= 82 && profit >= 50 && margin >= 20 &&
    (!(String(product.cat || '').startsWith('Kids')) || product.kidsGate === 'PASS');
}

export function normalizeProducts(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(p => p && typeof p === 'object' && String(p.name || '').trim()).map(p => ({
    ...p,
    name: String(p.name), cat: String(p.cat || 'Fără categorie'), evidence: String(p.evidence || ''),
    chinaMin: safeNumber(p.chinaMin), chinaMax: safeNumber(p.chinaMax), landed: safeNumber(p.landed),
    sell: safeNumber(p.sell), score: safeNumber(p.score), sourcing: Array.isArray(p.sourcing) ? p.sourcing : []
  }));
}

const money = value => `${safeNumber(value).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} lei`;
const text = (tag, value, className) => { const node=document.createElement(tag); node.textContent=String(value); if(className)node.className=className; return node; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const ACTIVE_SCAN = new Set(['queued', 'running']);
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 12 * 60 * 1000;
let products = [];
let scanPollToken = 0;

function metric(label, value) { const box=text('div','', 'metric'); box.append(text('small',label),text('b',value)); return box; }
function validUrl(value) { try { const u=new URL(String(value)); return ['https:','http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
function productCard(product) {
  const card=text('article','', 'card'), top=text('div','', 'top'), title=text('div','');
  title.append(text('div',product.name,'name'), text('span',isBuyZone(product)?'BUY ZONE':String(product.verdict || product.status || 'WATCH'),'pill'));
  top.append(title,text('div',`${Math.round(product.score)}/100`,'score')); card.append(top);
  const {profit,margin}=economics(product), metrics=text('div','', 'metrics');
  metrics.append(metric('Cost estimat',`${money(product.chinaMin)} – ${money(product.chinaMax)}`),metric('Landed cost',money(product.landed)),metric('Preț vânzare',money(product.sell)),metric('Profit / buc.',money(profit)),metric('Marjă',`${margin.toFixed(1)}%`),metric('Opportunity Score',`${Math.round(product.score)}/100`));
  card.append(metrics);
  if(product.evidence) card.append(text('div',product.evidence,'evidence'));
  const links=text('div','', 'links');
  for(const source of product.sourcing){ const href=validUrl(source?.url); if(!href)continue; const a=text('a',`${String(source.market || 'Sursă')}: ${String(source.label || 'detalii')} ↗`); a.href=href;a.target='_blank';a.rel='noopener noreferrer';links.append(a); }
  if(links.childNodes.length)card.append(links); return card;
}

function render() {
  const query=document.querySelector('#search').value.trim().toLocaleLowerCase('ro'), category=document.querySelector('#category').value;
  const visible=products.filter(p=>(!category||p.cat===category)&&(!query||`${p.name} ${p.cat}`.toLocaleLowerCase('ro').includes(query)));
  const root=document.querySelector('#products');root.replaceChildren(...(visible.length?visible.map(productCard):[text('div','Nu există produse pentru filtrele selectate.','empty')]));
  document.querySelector('#total').textContent=products.length;document.querySelector('#buyCount').textContent=products.filter(isBuyZone).length;
  document.querySelector('#avgScore').textContent=products.length?Math.round(products.reduce((n,p)=>n+p.score,0)/products.length):'—';
}

function setProducts(next){products=normalizeProducts(next);const select=document.querySelector('#category'),current=select.value;select.replaceChildren(new Option('Toate categoriile',''),...[...new Set(products.map(p=>p.cat))].sort().map(c=>new Option(c,c)));select.value=current;render();}

function updateStatus(data, source) {
  document.querySelector('#dataSource').textContent=source;
  document.querySelector('#lastScan').textContent=data.updatedAt?new Date(data.updatedAt).toLocaleString('ro-RO'):'Nicio scanare';
  const status=data.scan?.status || (data.live?'completed':'idle');
  document.querySelector('#scanStatus').textContent=status;
  document.querySelector('#scanError').textContent=data.scan?.error?` — ${data.scan.error}`:'';
  document.querySelector('#runScan').disabled=ACTIVE_SCAN.has(status);
  return status;
}

async function fetchRadar(fetcher=fetch) {
  const response=await fetcher(`/api/radar/data?t=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function loadRadar(fetcher=fetch) {
  try {
    const data=await fetchRadar(fetcher);
    if(data.live&&normalizeProducts(data.products).length){setProducts(data.products);updateStatus(data,'LIVE • radar-data');return data;}
    updateStatus(data,'Fallback • products.json');
    const fallback=await fetcher(`products.json?t=${Date.now()}`,{cache:'no-store'});
    if(!fallback.ok)throw new Error(`Fallback HTTP ${fallback.status}`);
    setProducts(await fallback.json());
    return data;
  } catch(error) {
    updateStatus({scan:{status:'error',error:error.message}},'Fallback • products.json');
    const fallback=await fetcher(`products.json?t=${Date.now()}`,{cache:'no-store'});
    if(!fallback.ok)throw new Error(`Fallback HTTP ${fallback.status}`);
    setProducts(await fallback.json());
    return {live:false,products,scan:{status:'error',error:error.message}};
  }
}

export async function pollScan(fetcher=fetch, { timeoutMs=POLL_TIMEOUT_MS, intervalMs=POLL_INTERVAL_MS }={}) {
  const token=++scanPollToken;
  const started=Date.now();
  while(token===scanPollToken && Date.now()-started<timeoutMs) {
    const data=await loadRadar(fetcher);
    const status=data?.scan?.status || (data?.live?'completed':'idle');
    if(!ACTIVE_SCAN.has(status)) return data;
    await wait(intervalMs);
  }
  if(token!==scanPollToken) return null;
  const timeout={scan:{status:'error',error:'Scanarea durează prea mult. Reîncarcă pagina și încearcă din nou.'}};
  updateStatus(timeout,document.querySelector('#dataSource').textContent);
  return timeout;
}

export async function runScan(fetcher=fetch){
  const button=document.querySelector('#runScan');
  scanPollToken++;
  button.disabled=true;
  document.querySelector('#scanStatus').textContent='queued';
  document.querySelector('#scanError').textContent='';
  try{
    const response=await fetcher('/api/radar/trigger',{method:'POST'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    updateStatus({scan:data.scan},document.querySelector('#dataSource').textContent);
    return await pollScan(fetcher);
  }catch(error){
    updateStatus({scan:{status:'error',error:error.message}},document.querySelector('#dataSource').textContent);
    throw error;
  }finally{
    const current=document.querySelector('#scanStatus').textContent;
    button.disabled=ACTIVE_SCAN.has(current);
  }
}

if(typeof document!=='undefined'){
  document.querySelector('#search').addEventListener('input',render);
  document.querySelector('#category').addEventListener('change',render);
  document.querySelector('#runScan').addEventListener('click',()=>runScan().catch(()=>{}));
  loadRadar().then(data=>{
    if(ACTIVE_SCAN.has(data?.scan?.status)) pollScan().catch(error=>updateStatus({scan:{status:'error',error:error.message}},document.querySelector('#dataSource').textContent));
  }).catch(error=>updateStatus({scan:{status:'error',error:error.message}},'Indisponibil'));
}
