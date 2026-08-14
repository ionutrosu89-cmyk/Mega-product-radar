import { roProductName } from './product-ro.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safe=u=>{try{const x=new URL(u);return['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return'#'}};
function commercialRoName(name,cat=''){
  const s=String(name||'').replace(/&#x27;|&#39;/gi,"'");
  const rules=[
    [/hair grippers?|hair clips?|claw clips?|barrettes?/i,'Set clipsuri și agrafe pentru păr'],
    [/hair elastics?|hair ties?|scrunchies?|hair bands?|head bands?/i,'Set elastice și accesorii pentru păr'],
    [/hair jewelry|braid(?:s|ing)? accessories|hair cuffs|loc jewelry|dreadlock/i,'Set accesorii decorative pentru păr și împletituri'],
    [/banana hair clips?/i,'Clamă tip banană pentru păr'],
    [/hair bun maker|bun clips?/i,'Accesoriu pentru realizarea cocului'],
    [/powder puff|makeup sponge|beauty sponge|blender sponge/i,'Set bureți și pufuri pentru machiaj'],
    [/makeup organizer cart|rolling makeup organizer/i,'Organizator mobil pentru cosmetice'],
    [/makeup bag|cosmetic bag|toiletry bag|vanity bag/i,'Geantă organizatoare pentru cosmetice'],
    [/refillable cosmetic.*bottles?|travel bottles?|squeeze bottles?/i,'Set recipiente cosmetice reîncărcabile pentru călătorie'],
    [/glitter freckles|face tattoo/i,'Set tatuaje cosmetice temporare tip pistrui'],
    [/car.*organizer|car organization/i,'Organizator auto'],
    [/car.*holder|car holder/i,'Suport auto'],
    [/car.*accessor/i,'Accesoriu auto'],
    [/kitchen.*organizer|food storage/i,'Organizator pentru bucătărie și depozitarea alimentelor'],
    [/kitchen.*gadget|kitchen.*tool/i,'Accesoriu practic pentru bucătărie'],
    [/travel.*organizer|luggage.*organizer/i,'Organizator pentru călătorie și bagaje'],
    [/travel.*accessor|luggage.*gadget/i,'Accesoriu de călătorie'],
    [/stroller.*accessor/i,'Accesoriu pentru cărucior'],
    [/baby.*organizer/i,'Organizator pentru bebeluși'],
    [/baby.*travel/i,'Accesoriu de călătorie pentru bebeluși'],
    [/kids.*activity|learning.*kids|activity.*kids/i,'Activitate educațională pentru copii'],
    [/kids.*organizer|kids.*organization/i,'Organizator pentru copii'],
    [/dog.*accessor|pet.*accessor/i,'Accesoriu pentru animale de companie'],
    [/cat.*accessor/i,'Accesoriu pentru pisici'],
    [/pet.*organizer/i,'Organizator pentru accesorii de animale'],
    [/fitness.*accessor|workout.*gadget/i,'Accesoriu pentru antrenament'],
    [/recovery.*accessor/i,'Accesoriu pentru recuperare'],
    [/home.*organizer|space saving home/i,'Organizator pentru casă, cu economie de spațiu'],
    [/home.*problem solver/i,'Accesoriu practic pentru casă']
  ];
  for(const [re,label] of rules)if(re.test(s)){
    const qty=s.match(/\b(\d{1,3})\s*(?:pcs|pc|ct|count|pack)\b/i)?.[1];
    return qty?`${label}, ${qty} buc.`:label;
  }
  const translated=roProductName(s).replace(/\bfor\b/gi,'pentru').replace(/\band\b/gi,'și').replace(/\bwith\b/gi,'cu').replace(/\bwomen\b/gi,'femei').replace(/\bmen\b/gi,'bărbați').replace(/\bhair\b/gi,'păr').replace(/\baccessories\b/gi,'accesorii').replace(/\baccessory\b/gi,'accesoriu').replace(/\bnew\b/gi,'nou').replace(/\bpack\b/gi,'set').replace(/\bpcs?\b/gi,'buc.').replace(/\bcount\b/gi,'buc.').replace(/\bblack\b/gi,'negru').replace(/\bbrown\b/gi,'maro').replace(/\bpink\b/gi,'roz').replace(/\bblue\b/gi,'albastru').replace(/\bwhite\b/gi,'alb').replace(/\bportable\b/gi,'portabil').replace(/\bwaterproof\b/gi,'impermeabil').replace(/\btransparent\b/gi,'transparent').replace(/\brefillable\b/gi,'reîncărcabil').replace(/\bset\b/gi,'set').replace(/\s+/g,' ').trim();
  if(/[a-z]{3,}\s+[a-z]{3,}/i.test(translated)&&!/[ăâîșț]/i.test(translated))return `Produs nou din categoria ${cat||'selectată'}`;
  return translated.slice(0,115);
}
function imageOk(u){const s=String(u||'');return /^https?:\/\//i.test(s)&&!/\.svg(?:$|\?)/i.test(s)&&!/01rrzVoKd5L|sprite|transparent|pixel|spacer|placeholder/i.test(s)}
let data={feed:[],products:[]},filter='ALL';
function fmtDelta(v){return v===null||v===undefined?'istoric în formare':v>0?`+${v} poziții`:v<0?`${v} poziții`:'fără schimbare'}
function card(p){const title=commercialRoName(p.name,p.category),img=imageOk(p.image)?`<img class="thumb" src="${esc(safe(p.image))}" alt="${esc(title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb placeholder',textContent:'Imagine indisponibilă încă'}))">`:`<div class="thumb placeholder">Imagine indisponibilă încă</div>`;const rev=p.reviewCount===null?'necunoscut':Math.trunc(Number(p.reviewCount));return `<article class="rise-card card">${img}<div><div class="topline"><div><div class="section-kicker">${esc(p.signal||'DE URMĂRIT')}</div><h3>${esc(title)}</h3><div class="cat">${esc(p.category||'')} • ${esc(p.sourceMarket||'')}</div></div><div class="score-pill"><b>${Number(p.organicRiseScore||0)}</b><small>URCARE</small></div></div><div class="meta-grid"><div class="metric"><small>Poziție organică</small><b>#${Number(p.organicRank||0)} / pag. ${Number(p.organicPage||0)}</b></div><div class="metric"><small>Review-uri</small><b>${esc(rev)}</b></div><div class="metric"><small>Selleri observați</small><b>${Number(p.observedSellerCount||0)}</b></div><div class="metric"><small>Competiție RO</small><b>${Number(p.romaniaCompetition||0)}</b></div><div class="metric"><small>Evoluție</small><b>${esc(fmtDelta(p.rankDelta))}</b></div><div class="metric"><small>Marketplace-uri</small><b>${Number(p.crossMarketCount||0)}</b></div></div><div class="validation">${esc(p.validation||'')}</div>${p.sourceUrl?`<a class="secondary-link source" href="${esc(safe(p.sourceUrl))}" target="_blank" rel="noopener">Deschide produsul sursă</a>`:''}</div></article>`}
function apply(){let list=[...(data.feed||[])];if(filter==='STRONG')list=list.filter(p=>Number(p.organicRiseScore||0)>=80);if(filter==='LOWREV')list=list.filter(p=>p.reviewCount!==null&&Number(p.reviewCount)<=10);if(filter==='LOWRO')list=list.filter(p=>Number(p.romaniaCompetition||0)<=3);$('#riseGrid').innerHTML=list.length?list.map(card).join(''):'<div class="empty card">Nu există încă produse care să treacă filtrul strict. Motorul continuă să scaneze și să construiască istoricul fără să inventeze semnale.</div>';$('#kFeed').textContent=(data.feed||[]).length;$('#kStrong').textContent=(data.feed||[]).filter(p=>Number(p.organicRiseScore||0)>=80).length;$('#kObserved').textContent=Number(data.totalObserved||0);$('#kCategory').textContent=data.category||'—'}
async function load(){try{const r=await fetch(`organic-rising-live.json?t=${Date.now()}`,{cache:'no-store'});if(r.ok)data=await r.json()}catch{}apply()}
document.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-f]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.f;apply()}));load();
