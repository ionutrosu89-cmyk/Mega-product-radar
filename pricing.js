import {SAAS_PLANS} from './billing-plans.js';
import {FREE_BETA_MODE,paidPlanInterestEvent} from './free-beta-mode.js';
import {getCurrentSession} from './supabase-client.js';
import {trackJourneyEvent} from './journey-events.js';

const copy={
  FREE:{badge:'Beta gratuită',desc:'Explorează nișele configurate și vezi ce clasamente au dovezi publicabile acum.',features:['25 de nișe configurate','Top 25 numai când există 25/25 poziții validate','Surse și date de observare etichetate','Feedback de produs']},
  DISCOVER:{badge:'Preț blocat',desc:'Pentru cei care vor semnale globale actuale și schimbări urmărite în timp.',features:['Tot din Free','Trend Intelligence','Rising + alerte','Filtre și istoric']},
  RADAR:{badge:'Preț blocat',desc:'Pentru sellerii care vor oportunități validate pentru piața din România.',features:['Tot din Discover','Romania Gap','Brand + importability gate','Opportunity Engine']},
  LAUNCH:{badge:'Preț blocat',desc:'Pentru utilizatorii care vor validare economică și traseul complet de execuție.',features:['Tot din Radar','Supplier Intelligence + benchmark','Landed cost, marjă și ROI','Launch Academy + workflow']}
};

const plans=document.getElementById('plans');
const status=document.getElementById('billingStatus');
const qs=new URLSearchParams(location.search);
const highlighted=String(qs.get('recommended')||qs.get('upgrade')||qs.get('interest')||'RADAR').toUpperCase();

const matrixRows=[
  ['25 de nișe configurate; Top 25 cu acoperire verificată','Topuri doar unde există 25/25 date','Inclus când există date','Inclus când există date','Inclus când există date'],
  ['Top Sellers + Top Brands + concentrare piață','Doar unde există date','Inclus când există date','Inclus când există date','Inclus când există date'],
  ['Rising / trenduri / alerte globale','—','Test interes','Test interes','Test interes'],
  ['Romania Gap + Opportunity Engine','—','—','Test interes','Test interes'],
  ['Brand gate + importability','Gate de bază','Gate de bază','Validare','Validare'],
  ['Supplier Intelligence + benchmark furnizori','—','—','—','Test interes'],
  ['Landed cost + profit + marjă + ROI','—','—','—','Test interes'],
  ['Launch Academy + plan de execuție','—','—','—','Test interes']
];
const matrixBody=document.querySelector('.matrix tbody');
if(matrixBody)matrixBody.innerHTML=matrixRows.map(row=>`<tr><td>${row[0]}</td>${row.slice(1).map(value=>`<td class="${value==='—'?'no':'yes'}">${value}</td>`).join('')}</tr>`).join('');

plans.innerHTML=Object.values(SAAS_PLANS).map(plan=>{
  const price=plan.monthlyPriceEur===0?'€0':`€${String(plan.monthlyPriceEur).replace('.',',')} <small>/ lună după beta</small>`;
  const action=plan.code==='FREE'
    ?'<a class="cta" href="top25.html">Vezi acoperirea actuală</a>'
    :`<button class="cta" data-interest-plan="${plan.code}">Aș testa ${plan.name} la acest preț</button>`;
  return `<article class="plan ${plan.code===highlighted?'featured':''}"><span class="badge">${plan.code===highlighted&&qs.get('recommended')?'Recomandat pentru tine':copy[plan.code].badge}</span><h2>${plan.name}</h2><div class="price">${price}</div><p class="desc">${copy[plan.code].desc}</p><ul class="features">${copy[plan.code].features.map(item=>`<li>${item}</li>`).join('')}</ul>${action}</article>`;
}).join('');

async function recordInterest(plan){
  const code=String(plan||'').toUpperCase();
  const session=await getCurrentSession();
  if(!session){
    location.href=`login.html?next=${encodeURIComponent(`pricing.html?interest=${code}`)}`;
    return false;
  }
  const recorded=await trackJourneyEvent(paidPlanInterestEvent(code),{source:'pricing_free_beta',targetPriceEur:SAAS_PLANS[code]?.monthlyPriceEur??null,freeBetaOnly:true});
  status.textContent=recorded?FREE_BETA_MODE.paidPlanMessage:'Nu am putut înregistra interesul. Reîncearcă după autentificare.';
  return recorded;
}

plans.addEventListener('click',async event=>{
  const button=event.target.closest('[data-interest-plan]');
  if(!button)return;
  button.disabled=true;
  await recordInterest(button.dataset.interestPlan);
  button.textContent='Interes înregistrat';
});

if(qs.get('interest')){
  recordInterest(qs.get('interest')).then(recorded=>{
    if(recorded)history.replaceState({},'',`pricing.html?recorded=${encodeURIComponent(qs.get('interest'))}`);
  });
}
