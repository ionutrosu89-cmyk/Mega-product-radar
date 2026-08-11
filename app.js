export const safeNumber=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function economics(product){const sell=safeNumber(product.sell),landed=safeNumber(product.landed);const profit=sell/1.21-sell*.17-sell*.08-landed;return{profit,margin:sell?profit/sell*100:0};}
export function isBuyZone(product){const{profit,margin}=economics(product);return safeNumber(product.score)>=82&&profit>=50&&margin>=20&&(!(String(product.cat||'').startsWith('Kids'))||product.kidsGate==='PASS');}
export function normalizeProducts(value){if(!Array.isArray(value))return[];return value.filter(p=>p&&typeof p==='object'&&String(p.name||'').trim()).map(p=>({...p,name:String(p.name),cat:String(p.cat||'Fără categorie'),evidence:String(p.evidence||''),chinaMin:safeNumber(p.chinaMin),chinaMax:safeNumber(p.chinaMax),landed:safeNumber(p.landed),sell:safeNumber(p.sell),score:safeNumber(p.score),sourcing:Array.isArray(p.sourcing)?p.sourcing:[]}));}

const money=value=>`${safeNumber(value).toLocaleString('ro-RO',{maximumFractionDigits:2})} lei`;
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=String(value);if(className)node.className=className;return node;};
let products=[];

function metric(label,value){const box=text('div','', 'metric');box.append(text('small',label),text('b',value));return box;}
function validUrl(value){try{const u=new URL(String(value));return['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function productCard(product){const card=text('article','', 'card'),top=text('div','', 'top'),title=text('div','');title.append(text('div',product.name,'name'),text('span',isBuyZone(product)?'BUY ZONE':String(product.verdict||product.status||'WATCH'),'pill'));top.append(title,text('div',`${Math.round(product.score)}/100`,'score'));card.append(top);const{profit,margin}=economics(product),metrics=text('div','', 'metrics');metrics.append(metric('Cost estimat',`${money(product.chinaMin)} – ${money(product.chinaMax)}`),metric('Landed cost',money(product.landed)),metric('Preț vânzare',money(product.sell)),metric('Profit / buc.',money(profit)),metric('Marjă',`${margin.toFixed(1)}%`),metric('Opportunity Score',`${Math.round(product.score)}/100`));card.append(metrics);if(product.evidence)card.append(text('div',product.evidence,'evidence'));const links=text('div','', 'links');for(const source of product.sourcing){const href=validUrl(source?.url);if(!href)continue;const a=text('a',`${String(source.market||'Sursă')}: ${String(source.label||'detalii')} ↗`);a.href=href;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}if(links.childNodes.length)card.append(links);return card;}
function render(){const query=document.querySelector('#search').value.trim().toLocaleLowerCase('ro'),category=document.querySelector('#category').value;const visible=products.filter(p=>(!category||p.cat===category)&&(!query||`${p.name} ${p.cat}`.toLocaleLowerCase('ro').includes(query)));const root=document.querySelector('#products');root.replaceChildren(...(visible.length?visible.map(productCard):[text('div','Nu există produse pentru filtrele selectate.','empty')]));document.querySelector('#total').textContent=products.length;document.querySelector('#buyCount').textContent=products.filter(isBuyZone).length;document.querySelector('#avgScore').textContent=products.length?Math.round(products.reduce((n,p)=>n+p.score,0)/products.length):'—';}
function setProducts(next){products=normalizeProducts(next);const select=document.querySelector('#category'),current=select.value;select.replaceChildren(new Option('Toate categoriile',''),...[...new Set(products.map(p=>p.cat))].sort().map(c=>new Option(c,c)));select.value=current;render();}
function updateStatus({updatedAt=null,status='ready',error=''},source){document.querySelector('#dataSource').textContent=source;document.querySelector('#lastScan').textContent=updatedAt?new Date(updatedAt).toLocaleString('ro-RO'):'Date inițiale';document.querySelector('#scanStatus').textContent=status;document.querySelector('#scanError').textContent=error?` — ${error}`:'';document.querySelector('#runScan').disabled=false;}

export async function loadRadar(fetcher=fetch){
  try{
    const liveResponse=await fetcher(`radar-live.json?t=${Date.now()}`,{cache:'no-store'});
    if(liveResponse.ok){const live=await liveResponse.json();if(live.live&&normalizeProducts(live.products).length){setProducts(live.products);updateStatus({updatedAt:live.updatedAt,status:'actualizat automat'},'GitHub Actions • LIVE');return live;}}
  }catch{}
  const fallback=await fetcher(`products.json?t=${Date.now()}`,{cache:'no-store'});
  if(!fallback.ok)throw new Error(`HTTP ${fallback.status}`);
  setProducts(await fallback.json());
  updateStatus({status:'date de bază'},'GitHub Pages • products.json');
  return{live:false,products};
}

export async function runScan(fetcher=fetch){
  const button=document.querySelector('#runScan');button.disabled=true;button.textContent='Se actualizează…';document.querySelector('#scanError').textContent='';
  try{return await loadRadar(fetcher);}catch(error){updateStatus({status:'error',error:error.message},'GitHub Pages');throw error;}finally{button.disabled=false;button.textContent='Refresh';}
}

if(typeof document!=='undefined'){
  document.querySelector('#search').addEventListener('input',render);
  document.querySelector('#category').addEventListener('change',render);
  document.querySelector('#runScan').addEventListener('click',()=>runScan().catch(()=>{}));
  loadRadar().catch(error=>updateStatus({status:'error',error:error.message},'Indisponibil'));
}
