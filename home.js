import {getCurrentSession} from './supabase-client.js';
import {resolveCommercialAccess} from './commercial-access.js';
import {loadSellerPreferences} from './seller-preferences.js';
import {trackJourneyEvent,installJourneyLinkTracking} from './journey-events.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const PLAN_RANK={FREE:0,DISCOVER:1,RADAR:2,LAUNCH:3};
const nextUpgrade={FREE:{code:'DISCOVER',price:'€17,90',why:'Adaugă Rising, New, istoric, filtre, alerte și prioritizare cross-source peste Top 25 pe nișă.'},DISCOVER:{code:'RADAR',price:'€29',why:'Transformă trendurile în oportunități pentru România, cu economics și TEST/HOLD.'},RADAR:{code:'LAUNCH',price:'€89',why:'Primești shortlist personalizat, plan de buget și execuție.'}};

function card(title,text,href,label,event,locked=false){return `<article class="card ${locked?'locked':''}"><h3>${esc(title)}</h3><p>${esc(text)}</p><a ${locked?'class="secondary"':''} href="${href}" data-journey-event="${event}">${esc(label)}</a></article>`;}
function tags(p){const out=[];if(p.experience_level)out.push(p.experience_level);if(Number(p.monthly_budget_ron)>0)out.push(`${Number(p.monthly_budget_ron).toLocaleString('ro-RO')} lei/lună`);if((p.marketplaces||[]).length)out.push((p.marketplaces||[]).slice(0,2).join(' · '));return out.map(x=>`<span class="tag">${esc(x)}</span>`).join('');}

async function load(){
  const session=await getCurrentSession();
  if(!session){location.href='login.html?next=home.html';return;}
  const [access,prefs]=await Promise.all([resolveCommercialAccess(),loadSellerPreferences()]);
  if(!prefs.onboarding_completed){location.href='onboarding.html?first=1';return;}
  const plan=access.plan.code,rank=PLAN_RANK[plan]??0;
  $('#planName').textContent=plan;
  $('#subtitle').textContent=`Plan ${access.plan.name} · recomandări adaptate profilului tău`;
  $('#welcomeTitle').textContent=plan==='FREE'?'Începe cu Top 25 pe nișa ta':plan==='DISCOVER'?'Găsește semnalele care merită urmărite':plan==='RADAR'?'Transformă semnalele în decizii comerciale':'Construiește și execută planul de lansare';
  $('#welcomeText').textContent=plan==='FREE'?'Alege nișa și vezi 25 de produse documentate cu sursă, rank și statistici publice când există.':plan==='DISCOVER'?'Folosește Discover pentru a găsi produsele în creștere, apoi treci în Radar când vrei validare pentru România.':plan==='RADAR'?'Concentrează-te pe produsele cu cele mai puține blocaje și nu aloca bani până când landed cost-ul și gate-urile sunt confirmate.':'Folosește shortlist-ul personalizat, bugetul și traseul de execuție pentru testele reale.';
  $('#profileMeta').innerHTML=tags(prefs);
  const completed=[prefs.onboarding_completed,rank>=0,rank>=1,rank>=2].filter(Boolean).length;
  $('#progressText').textContent=`${completed}/4 pași de maturitate comercială`;
  $('#progressBar').style.width=`${completed/4*100}%`;
  const cards=[];
  cards.push(card('1. Top 25 pe nișă','Topuri Free documentate: Casă, Auto, Electronice, Beauty, Pet, Sport, Copii și Birou.','top25.html','Deschide Top 25','HOME_OPEN_TOP25'));
  cards.push(card('2. Discover',rank>=1?'Vezi Rising, New, istoric, filtre și semnale prioritizate după dovezi.':'Deblochează semnalele dinamice și prioritizarea cross-source.',rank>=1?'discover.html':'pricing.html?upgrade=DISCOVER',rank>=1?'Deschide Discover':'Vezi Discover · €17,90',rank>=1?'HOME_OPEN_DISCOVER':'UPGRADE_INTENT_DISCOVER',rank<1));
  cards.push(card('3. Radar',rank>=2?'Vezi România Gap, furnizor, landed cost, profit, ROI și verdictul TEST/HOLD.':'Deblochează validarea comercială pentru România.',rank>=2?'commercial-radar.html':'pricing.html?upgrade=RADAR',rank>=2?'Deschide Radar':'Vezi Radar · €29',rank>=2?'HOME_OPEN_RADAR':'UPGRADE_INTENT_RADAR',rank<2));
  cards.push(card('4. Launch',rank>=3?'Vezi shortlist-ul personalizat, bugetul și următorii pași de execuție.':'Deblochează planul complet de lansare și capital.',rank>=3?'commercial-launch.html':'pricing.html?upgrade=LAUNCH',rank>=3?'Deschide Launch':'Vezi Launch · €89',rank>=3?'HOME_OPEN_LAUNCH':'UPGRADE_INTENT_LAUNCH',rank<3));
  $('#cards').innerHTML=cards.join('');
  const up=nextUpgrade[plan],box=$('#upgrade');
  if(up){box.hidden=false;box.innerHTML=`<h3>Următorul nivel: ${up.code} · ${up.price}/lună</h3><p>${esc(up.why)}</p><a href="pricing.html?upgrade=${up.code}" data-journey-event="HOME_UPGRADE_${up.code}">Vezi ce deblochează</a>`;}
  installJourneyLinkTracking();
  trackJourneyEvent('HOME_VIEW',{plan,experience:prefs.experience_level,goal:prefs.goal,onboarding:true});
}
load().catch(error=>{document.body.innerHTML=`<main style="padding:24px;font-family:sans-serif"><b>Dashboard indisponibil momentan.</b><p>${esc(error?.message||error)}</p></main>`;});
