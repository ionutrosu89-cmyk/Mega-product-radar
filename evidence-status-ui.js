import {productEvidenceFreshness} from './evidence-freshness.js';
const labels={CURRENT:'Date recente',STALE:'Date expirate — reverificare necesară',UNKNOWN:'Data verificării necunoscută',INVALID_FUTURE:'Data sursei este invalidă'};
export function evidenceStatusElement(product){
 const f=productEvidenceFreshness(product),section=document.createElement('section');section.className='card';section.setAttribute('aria-label','Calitatea dovezilor');
 const title=document.createElement('h2');title.textContent=labels[f.status];section.append(title);
 const line=document.createElement('p');line.textContent=`Ultima verificare: ${f.observedAt?new Date(f.observedAt).toLocaleString('ro-RO'):'necunoscută'}. ${f.evidenceClass==='OBSERVED'?'Date observate; consultă sursa pentru domeniul lor de aplicare.':'Estimări sau informații neconfirmate; nu reprezintă vânzări verificate.'}`;section.append(line);
 const sources=(product.sourcingLinks||[]).slice(0,3);
 for(const s of sources){try{const url=new URL(s.url);if(!['https:','http:'].includes(url.protocol))continue;const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${s.market||url.hostname} — ${s.verified===true?'sursă declarată verificată':'link de cercetare, ofertă neconfirmată'}`;a.style.display='block';section.append(a);}catch{}}
 return section;
}
