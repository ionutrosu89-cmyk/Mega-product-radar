import {getCurrentSession,getSupabaseClient} from './supabase-client.js';
import {resolveCommercialAccess} from './commercial-access.js';
import {loadSellerPreferences} from './seller-preferences.js';
import {trackJourneyEvent,installJourneyLinkTracking} from './journey-events.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const PLAN_RANK={FREE:0,DISCOVER:1,RADAR:2,LAUNCH:3};
const nextUpgrade={FREE:{code:'DISCOVER',price:'€17,90',why:'Spune-ne dacă ai testa produse în creștere, istoric, filtre și semnale prioritizate.'},DISCOVER:{code:'RADAR',price:'€29',why:'Spune-ne dacă ai folosi oportunități validate pentru România, cu economics și verdict TEST/HOLD.'},RADAR:{code:'LAUNCH',price:'€89',why:'Spune-ne dacă ai folosi shortlist-ul, bugetul și pașii de execuție.'}};

function card(title,text,href,label,event,locked=false){return `<article class="card ${locked?'locked':''}"><h3>${esc(title)}</h3><p>${esc(text)}</p><a ${locked?'class="secondary"':''} href="${href}" data-journey-event="${event}">${esc(label)}</a></article>`;}
function tags(p){const out=[];if(p.experience_level)out.push(p.experience_level==='BEGINNER'?'Începător':p.experience_level==='SELLER'?'Seller activ':'Avansat');if(Number(p.monthly_budget_ron)>0)out.push(`${Number(p.monthly_budget_ron).toLocaleString('ro-RO')} lei/lună`);if((p.marketplaces||[]).length)out.push((p.marketplaces||[]).slice(0,2).join(' · '));return out.map(x=>`<span class="tag">${esc(x)}</span>`).join('');}

async function load(){
  const session=await getCurrentSession();
  if(!session){location.href='login.html?next=home.html';return;}
  const [access,prefs]=await Promise.all([resolveCommercialAccess(),loadSellerPreferences()]);
  if(!prefs.onboarding_completed){location.href='onboarding.html?first=1';return;}
  const plan=access.plan.code,rank=PLAN_RANK[plan]??0;
  $('#planName').textContent=plan;
  $('#subtitle').textContent=`Plan ${access.plan.name} · recomandări adaptate profilului tău`;
  $('#welcomeTitle').textContent=plan==='FREE'?'Începe cu produsele documentate':plan==='DISCOVER'?'Găsește semnalele care merită urmărite':plan==='RADAR'?'Transformă semnalele în decizii comerciale':'Construiește planul de lansare';
  $('#welcomeText').textContent=plan==='FREE'?'Alege nișa și explorează produse documentate cu sursă, poziție și statistici publice când există.':plan==='DISCOVER'?'Folosește Discover pentru a găsi produsele în creștere, apoi treci în Radar când vrei validare pentru România.':plan==='RADAR'?'Concentrează-te pe produsele cu cele mai puține blocaje și nu aloca bani până când landed cost-ul și gate-urile sunt confirmate.':'Folosește shortlist-ul personalizat, bugetul și traseul de execuție pentru testele reale.';
  $('#profileMeta').innerHTML=tags(prefs);
  const profileChecks=[Boolean(prefs.onboarding_completed),Number(prefs.monthly_budget_ron)>0,(prefs.marketplaces||[]).length>0,(prefs.categories||[]).length>0];
  const completed=profileChecks.filter(Boolean).length;
  $('#progressText').textContent=`${completed}/4 elemente completate`;
  $('#progressBar').style.width=`${completed/4*100}%`;
  const cards=[];
  cards.push(card('1. Top 25 pe nișă','Explorează topuri documentate pentru categoriile principale.','top25.html','Vezi Top 25','HOME_OPEN_TOP25'));
  cards.push(card('2. Discover',rank>=1?'Vezi produse Rising/New, istoric, filtre și semnale prioritizate după dovezi.':'Înregistrează dacă ai testa semnalele dinamice și prioritizarea cross-source.',rank>=1?'discover.html':'pricing.html?interest=DISCOVER',rank>=1?'Deschide Discover':'Marchează interesul · €17,90',rank>=1?'HOME_OPEN_DISCOVER':'UPGRADE_INTENT_DISCOVER',rank<1));
  cards.push(card('3. Radar',rank>=2?'Vezi România Gap, furnizor, landed cost, profit, ROI și verdict TEST/HOLD.':'Înregistrează dacă ai testa validarea comercială pentru România.',rank>=2?'commercial-radar.html':'pricing.html?interest=RADAR',rank>=2?'Deschide Radar':'Marchează interesul · €29',rank>=2?'HOME_OPEN_RADAR':'UPGRADE_INTENT_RADAR',rank<2));
  cards.push(card('4. Launch',rank>=3?'Vezi shortlist-ul personalizat, bugetul și pașii de execuție.':'Înregistrează dacă ai testa planul complet de lansare și capital.',rank>=3?'commercial-launch.html':'pricing.html?interest=LAUNCH',rank>=3?'Deschide Launch':'Marchează interesul · €89',rank>=3?'HOME_OPEN_LAUNCH':'UPGRADE_INTENT_LAUNCH',rank<3));
  $('#cards').innerHTML=cards.join('');
  const up=nextUpgrade[plan],box=$('#upgrade');
  if(up){box.hidden=false;box.innerHTML=`<h3>Ipoteză de preț: ${up.code} · ${up.price}/lună</h3><p>${esc(up.why)} Nu se solicită card și nu se activează o plată.</p><a href="pricing.html?interest=${up.code}" data-journey-event="HOME_UPGRADE_${up.code}">Marchează interesul</a>`;}
  installJourneyLinkTracking();
  trackJourneyEvent('HOME_VIEW',{plan,experience:prefs.experience_level,goal:prefs.goal,onboarding:true});
}

async function start(){
  try{await load();}
  catch(error){
    const message=String(error?.message||error||'');
    if(/JWT issued at future/i.test(message)){
      try{
        await new Promise(r=>setTimeout(r,900));
        const client=await getSupabaseClient();
        await client?.auth?.refreshSession?.();
        await load();
        return;
      }catch(retryError){error=retryError;}
    }
    document.body.innerHTML=`<main style="padding:24px;font-family:sans-serif"><b>Dashboard indisponibil momentan.</b><p>Conexiunea nu a putut fi reîmprospătată. Încearcă din nou.</p><a href="home.html">Reîncarcă Home</a></main>`;
  }
}
start();
