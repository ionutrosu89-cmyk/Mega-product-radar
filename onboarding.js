import {getCurrentSession} from './supabase-client.js';
import {loadSellerPreferences,saveSellerPreferences} from './seller-preferences.js';
import {trackJourneyEvent} from './journey-events.js';

const $=s=>document.querySelector(s);
let step=1;
function selected(container){return [...container.querySelectorAll('.chip.active')].map(x=>x.dataset.value).filter(Boolean);}
function setSelected(container,values=[]){const set=new Set(values);container.querySelectorAll('.chip').forEach(x=>{const active=set.has(x.dataset.value);x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});}
function installChips(container){container.querySelectorAll('.chip').forEach(x=>x.addEventListener('click',()=>{const active=!x.classList.contains('active');x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));}));}
function renderStep(){document.querySelectorAll('.onboarding-step').forEach(x=>x.hidden=Number(x.dataset.step)!==step);$('#stepLabel').textContent=`Pasul ${step} din 4`;$('#stepBar').style.width=`${step/4*100}%`;$('#back').hidden=step===1;$('#next').hidden=step===4;$('#save').hidden=step!==4;document.querySelector(`[data-step="${step}"]`)?.querySelector('select,input,button')?.focus({preventScroll:true});}
function planRecommendation(profile,decisionNeed,chinaAgent){
  if(chinaAgent==='YES'||decisionNeed==='EXECUTE')return {code:'LAUNCH',price:'€89/lună',title:'Launch',reasons:['Vrei un plan concret de test și execuție, nu doar semnale.','Ai acces la shortlist, buget și traseu de lansare.','Launch include acces la un agent China testat/verificat de noi; serviciile efective ale agentului se contractează separat.']};
  if(decisionNeed==='VALIDATE')return {code:'RADAR',price:'€29/lună',title:'Radar',reasons:['Vrei să validezi oportunități pentru România înainte să blochezi capital.','Ai nevoie de România Gap, furnizor, landed cost, profit, ROI și gate-uri comerciale.']};
  if(decisionNeed==='TRENDS')return {code:'DISCOVER',price:'€17,90/lună',title:'Discover',reasons:['Vrei trenduri, produse Rising/New, istoric, filtre și alerte.','Nu ai cerut încă validare comercială completă sau plan de execuție.']};
  return {code:'FREE',price:'€0',title:'Free',reasons:['Vrei să explorezi produse și nișe înainte să plătești pentru analiză mai profundă.','Poți începe gratuit și face upgrade doar când apare o nevoie reală.']};
}
function showRecommendation(rec){
  const box=$('#recommendation');
  box.hidden=false;
  box.innerHTML=`<div class="customer-eyebrow" style="color:#175cd3!important">PLAN RECOMANDAT</div><h3>${rec.title} · ${rec.price}</h3><p>Pe baza răspunsurilor tale, acesta este nivelul care se potrivește cel mai bine acum.</p><div class="recommendation-reasons">${rec.reasons.map(x=>`<div>✓ ${x}</div>`).join('')}</div><div class="recommendation-actions">${rec.code==='FREE'?'<a class="primary" href="home.html">Începe cu Free</a>':`<a class="primary" href="pricing.html?recommended=${rec.code}">Vezi ${rec.title}</a>`}<a class="secondary" href="home.html">Mergi la Home</a></div>`;
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}

$('#next').addEventListener('click',()=>{if(step<4){step++;renderStep();trackJourneyEvent('ONBOARDING_STEP_VIEW',{step});}});
$('#back').addEventListener('click',()=>{if(step>1){step--;renderStep();}});

async function load(){
  const session=await getCurrentSession();
  if(!session){location.href='login.html?next=onboarding.html';return;}
  installChips($('#marketplaces'));installChips($('#categories'));
  try{
    const p=await loadSellerPreferences();
    $('#experience').value=p.experience_level||'BEGINNER';
    $('#budget').value=Number(p.monthly_budget_ron||3000);
    $('#goal').value=p.goal||'FIND_PRODUCTS';
    $('#risk').value=p.risk_profile||'BALANCED';
    $('#sourcing').value=p.sourcing_preference||'CHINA';
    setSelected($('#marketplaces'),p.marketplaces?.length?p.marketplaces:['EMAG_RO']);
    setSelected($('#categories'),p.categories||[]);
    try{const saved=JSON.parse(localStorage.getItem('mpr_plan_finder_v1')||'{}');if(saved.decisionNeed)$('#decisionNeed').value=saved.decisionNeed;if(saved.chinaAgent)$('#chinaAgent').value=saved.chinaAgent;}catch{}
    trackJourneyEvent('ONBOARDING_VIEW',{completed:Boolean(p.onboarding_completed)});
  }catch(e){$('#status').textContent=`Nu am putut încărca profilul: ${e.message}`;}
  renderStep();
}

$('#form').addEventListener('submit',async e=>{
  e.preventDefault();
  $('#status').textContent='Salvăm profilul și calculăm recomandarea…';
  $('#save').disabled=true;
  try{
    const profile={experience_level:$('#experience').value,monthly_budget_ron:Number($('#budget').value||0),goal:$('#goal').value,risk_profile:$('#risk').value,sourcing_preference:$('#sourcing').value,marketplaces:selected($('#marketplaces')),categories:selected($('#categories'))};
    const decisionNeed=$('#decisionNeed').value,chinaAgent=$('#chinaAgent').value;
    await saveSellerPreferences(profile);
    const rec=planRecommendation(profile,decisionNeed,chinaAgent);
    localStorage.setItem('mpr_plan_finder_v1',JSON.stringify({decisionNeed,chinaAgent,recommendedPlan:rec.code,updatedAt:new Date().toISOString()}));
    await trackJourneyEvent('ONBOARDING_COMPLETED',{experience:profile.experience_level,goal:profile.goal,budget:profile.monthly_budget_ron,marketplaceCount:profile.marketplaces.length,categoryCount:profile.categories.length});
    await trackJourneyEvent('PLAN_RECOMMENDED',{plan:rec.code,decisionNeed,chinaAgent:chinaAgent==='YES',budget:profile.monthly_budget_ron});
    $('#status').textContent='Profil salvat. Am calculat recomandarea potrivită pentru nevoile tale.';
    showRecommendation(rec);
  }catch(error){$('#status').textContent=`Eroare: ${error.message}`;$('#save').disabled=false;}
});
load();
