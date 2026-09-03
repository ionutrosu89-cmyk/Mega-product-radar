import {SAAS_PLANS} from './billing-plans.js';
import {FREE_BETA_MODE,paidPlanInterestEvent} from './free-beta-mode.js';
import {getCurrentSession} from './supabase-client.js';
import {trackJourneyEvent} from './journey-events.js';

const copy={
  FREE:{badge:'Activ acum',desc:'Pentru utilizatorii care vor topuri pe nișe înainte să plătească.',features:['Category Universe + Top Products','Top Sellers și Top Brands','Semnale publice etichetate','Feedback de produs']},
  DISCOVER:{badge:'Preț blocat',desc:'Pentru cei care vor semnale globale actuale și schimbări urmărite în timp.',features:['Tot din Free','Trend Intelligence','Rising + alerte','Filtre și istoric']},
  RADAR:{badge:'Preț blocat',desc:'Pentru sellerii care vor oportunități validate pentru piața din România.',features:['Tot din Discover','Romania Gap','Brand + importability gate','Opportunity Engine']},
  LAUNCH:{badge:'Preț blocat',desc:'Pentru utilizatorii care vor validare economică și traseul complet de execuție.',features:['Tot din Radar','Supplier Intelligence + benchmark','Landed cost, marjă și ROI','Launch Academy + workflow']}
};

const plans=document.getElementById('plans');
const status=document.getElementById('billingStatus');
const qs=new URLSearchParams(location.search);
const highlighted=String(qs.get('recommended')||qs.get('upgrade')||qs.get('interest')||'RADAR').toUpperCase();

const matrixRows=[
  ['Category Universe + topuri produse pe nișe','Activ','Inclus','Inclus','Inclus'],
  ['Top Sellers + Top Brands + concentrare piață','Activ limitat','Inclus','Inclus','Inclus'],
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
    ?'<a class="cta" href="top25.html">Vezi topurile gratuite</a>'
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
