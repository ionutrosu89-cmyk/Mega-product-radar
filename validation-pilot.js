import {evidenceFreshness} from './evidence-freshness.js';
const el=(tag,text,parent)=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
try{
 const results=await Promise.all(['validation-pilot-live.json','source-inventory-live.json'].map(async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Date indisponibile');return r.json();}));
 const [pilot,inventory]=results;
 document.querySelector('#summary').textContent=`Verificare: ${new Date(pilot.reviewedAt).toLocaleDateString('ro-RO')}. ${pilot.stats.held}/${pilot.stats.products} produse în așteptare. ${pilot.warning}`;
 for(const p of pilot.items){
  const article=el('article','',document.querySelector('#products'));el('h2',p.name,article);
  el('p',`Aplicație: ${p.applicationStage} · Verificare documentară: nu avansează`,article).className='status';
  el('p',p.review,article);el('p',`Următoarea dovadă: ${p.nextEvidence}`,article);
  el('p',`Ultima observație în dataset: ${p.freshness.observedAt||'necunoscută'} · ${evidenceFreshness(p.freshness.observedAt).status}`,article);
  const list=el('ul','',article);
  for(const s of p.sources){const li=el('li',`${s.scope} — ${s.access==='PAGE_READ'?'pagină citită la data verificării':'rezultat indexat, fără ofertă confirmată'}: `,list);try{const u=new URL(s.url);if(!['https:','http:'].includes(u.protocol))continue;const a=el('a',u.hostname,li);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{}}
 }
 document.querySelector('#inventory-date').textContent=`Inventar la ${inventory.auditedAt}; starea de prospețime de mai jos se recalculează la deschiderea paginii.`;
 for(const s of inventory.sources){const ro=['EMAG_RO','RO_RETAIL_WEB','TRENDYOL_RO'].includes(s.key);el('li',`${s.key}: ${s.rows} observații; ultima ${s.lastObservedAt}; ${evidenceFreshness(s.lastObservedAt,{kind:ro?'romania':'marketplace'}).status}; programare ${s.schedule||'neconfirmată'}.`,document.querySelector('#sources'));}
}catch(error){document.querySelector('#summary').textContent='Nu putem încărca lotul de validare. Reîncearcă mai târziu.';}
