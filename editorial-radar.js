import {freshEditorialProducts,EDITORIAL_EVIDENCE_TYPES} from './editorial-radar-v1.js';
import {freeProductKey,readFreeShortlist,toggleFreeShortlist} from './free-shortlist.js';
import {getCurrentSession} from './supabase-client.js';

const $=selector=>document.querySelector(selector);
const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=String(text);if(className)element.className=className;return element;};
const formatDate=value=>new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));
const sourceCount=product=>new Set(product.evidence.map(row=>row.sourceUrl)).size;
const keyFor=product=>freeProductKey({externalId:product.id},'MPR_EDITORIAL');
let feed=null,products=[],saved=new Set(),userId=undefined;

function saveButton(product){
  const button=node('button',saved.has(keyFor(product))?'★ Salvat':'☆ Salvează');
  button.type='button';button.dataset.save=product.id;button.setAttribute('aria-pressed',String(saved.has(keyFor(product))));
  return button;
}

function renderDetail(product){
  const root=$('#detail');root.replaceChildren();root.hidden=!product;
  if(!product)return;
  root.append(node('span','În cercetare','badge'),node('h2',product.title),node('p',product.need),node('h3','De ce este inclus'),node('p',product.rationale));
  root.append(node('p',`Nișă: ${feed.niches.find(row=>row.id===product.nicheId)?.label||product.nicheId} · revizie: ${formatDate(product.lastReviewedAt)}`,'meta'));
  root.append(node('h3','Dovezi actuale'));
  for(const item of product.evidence){
    const row=node('div',undefined,'evidence');row.append(node('b',item.label),node('p',item.summary),node('small',`${item.sourceName} · observat ${formatDate(item.observedAt)} · colectat ${formatDate(item.retrievedAt)}`));
    const link=node('a','Deschide sursa originală');link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';row.append(link);root.append(row);
  }
  root.append(node('h3','Ce lipsește'));
  const missing=product.missingEvidence.map(type=>EDITORIAL_EVIDENCE_TYPES[type]?.label||type);
  root.append(node('p',missing.length?missing.join(' · '):'Nu lipsesc clasele de dovezi din dosarul editorial. Verificarea comercială rămâne separată.','unknown'));
  if(product.expiredEvidenceCount)root.append(node('p',`${product.expiredEvidenceCount} observații au expirat și nu mai susțin fișa.`,'unknown'));
  root.append(node('p','Următoarea acțiune: verifică potrivirea exactă cu oferta din România, obține oferta scrisă a furnizorului și calculează costul complet. Până atunci nu există verdict comercial.'));
  const actions=node('div',undefined,'actions');actions.append(saveButton(product));root.append(actions);
}

function render(){
  const niche=$('#nicheSelect').value,search=$('#search').value.toLocaleLowerCase('ro').trim(),savedOnly=$('#savedOnly').checked;
  const visible=products.filter(product=>(!niche||product.nicheId===niche)&&(!search||`${product.title} ${product.need}`.toLocaleLowerCase('ro').includes(search))&&(!savedOnly||saved.has(keyFor(product))));
  $('#count').textContent=`${visible.length} produse afișate · ${products.length} fișe editoriale actuale · 25 nișe configurate`;
  const grid=$('#grid');grid.replaceChildren();
  if(!visible.length){grid.append(node('div',products.length?'Niciun produs nu corespunde filtrului.':'Nu există încă fișe aprobate și actuale. Cercetarea și revizia continuă; nu completăm lista cu produse vechi sau fără drepturi.','empty'));}
  for(const product of visible){
    const card=node('article',undefined,'card');card.append(node('span','În cercetare','badge'),node('h2',product.title),node('p',product.need));
    card.append(node('p',`${feed.niches.find(row=>row.id===product.nicheId)?.label||product.nicheId} · ${sourceCount(product)} surse distincte · ${product.evidence.length} observații actuale · revizuit ${formatDate(product.lastReviewedAt)}`,'meta'));
    const actions=node('div',undefined,'actions'),link=node('a','Vezi fișa');link.href=`editorial-radar.html?product=${encodeURIComponent(product.id)}`;actions.append(link,saveButton(product));card.append(actions);grid.append(card);
  }
  const selected=new URLSearchParams(location.search).get('product');renderDetail(products.find(item=>item.id===selected)||null);
}

async function refreshAccount(){
  let next=null;try{next=(await getCurrentSession())?.user?.id||null;}catch{next='UNAVAILABLE';}
  if(next===userId)return;userId=next;saved=readFreeShortlist(undefined,userId);render();
}

async function start(){
  try{
    const response=await fetch('editorial-radar-v1.json',{cache:'no-store'});
    if(!response.ok)throw new Error('FEED_UNAVAILABLE');
    feed=await response.json();products=freshEditorialProducts(feed);
    if(feed?.schema!=='MPR_EDITORIAL_RADAR_V1')throw new Error('FEED_INVALID');
    for(const niche of feed.niches){const option=node('option',`${niche.emoji} ${niche.label} (${products.filter(item=>item.nicheId===niche.id).length})`);option.value=niche.id;$('#nicheSelect').append(option);}
    $('#nicheSelect').addEventListener('change',render);$('#search').addEventListener('input',render);$('#savedOnly').addEventListener('change',render);
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-save]');if(!button)return;
      const product=products.find(row=>row.id===button.dataset.save);if(!product)return;
      const result=toggleFreeShortlist(saved,keyFor(product),undefined,userId);
      if(result.changed){saved=result.values;$('#saveStatus').textContent=result.added?'Produs salvat în acest browser.':'Produs eliminat din lista salvată.';render();}
      else $('#saveStatus').textContent=result.reason==='LIMIT_REACHED'?'Lista salvată are maximum 100 de produse.':'Nu am putut salva în browser. Verifică permisiunile de stocare.';
    });
    window.addEventListener('focus',refreshAccount);window.addEventListener('pageshow',refreshAccount);
    await refreshAccount();render();
  }catch{$('#count').textContent='Selecția nu poate fi încărcată acum.';$('#grid').replaceChildren(node('div','Datele editoriale nu sunt disponibile. Încearcă din nou mai târziu.','empty'));}
}
start();
