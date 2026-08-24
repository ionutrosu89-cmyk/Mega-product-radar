import {applyPrivateCommercialDecisions} from './commercial-decision-client.js';
import {buildTestPlan,startRealTest,measureRealTest} from './test-execution-engine.js';
import {listTestExecutions,saveTestExecution} from './test-execution-client.js';
import {roProductName} from './product-ro.js';

const hasDom=typeof document!=='undefined';
const $=s=>hasDom?document.querySelector(s):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
let products=[],runs=[];

function statusClass(s){return s==='MEASURED'?'good':s==='RUNNING'?'warn':'';}
function runCard(r){
  const outcome=r.outcome||null;
  const measure=r.status==='RUNNING'?`<div class="measure">
    <label>Bucăți primite<input data-f="unitsReceived" type="number" min="0"></label><label>Bucăți vândute<input data-f="unitsSold" type="number" min="0"></label><label>Venit real RON<input data-f="revenueRon" type="number" min="0" step="0.01"></label>
    <label>Ads RON<input data-f="adSpendRon" type="number" min="0" step="0.01"></label><label>Comisioane marketplace RON<input data-f="marketplaceFeesRon" type="number" min="0" step="0.01"></label><label>Fulfillment / livrare RON<input data-f="fulfillmentCostRon" type="number" min="0" step="0.01"></label>
    <label>Retururi bucăți<input data-f="returnsCount" type="number" min="0"></label><label>Cost retururi RON<input data-f="returnsCostRon" type="number" min="0" step="0.01"></label><label>Alte costuri RON<input data-f="otherCostsRon" type="number" min="0" step="0.01"></label>
    <label>Data măsurării<input data-f="measuredAt" type="datetime-local"></label>
  </div><div class="row" style="margin-top:10px"><button class="btn primary" data-measure="${esc(r.runKey)}">Salvează măsurarea reală</button></div>`:'';
  const start=r.status==='PLANNED'?`<div class="measure"><label>Referință comandă reală<input data-order-ref placeholder="Alibaba order / PO / factură"></label><label style="display:flex;gap:7px;align-items:center;margin-top:20px"><input data-order-confirm type="checkbox" style="width:auto"> Confirm că această comandă a fost făcută real</label></div><div class="row" style="margin-top:10px"><button class="btn primary" data-start="${esc(r.runKey)}">Pornește testul real</button></div>`:'';
  const metrics=outcome?`<div class="metrics" style="margin-top:10px"><div class="metric"><small>Sell-through</small><b>${num(outcome.metrics?.sellThroughPct).toFixed(1)}%</b></div><div class="metric"><small>Marjă netă test</small><b>${num(outcome.metrics?.netMarginPct).toFixed(1)}%</b></div><div class="metric"><small>Retururi</small><b>${num(outcome.metrics?.returnRatePct).toFixed(1)}%</b></div><div class="metric"><small>Profit contribuție</small><b>${num(outcome.metrics?.contributionProfitRon).toFixed(2)} lei</b></div></div><p class="${outcome.status==='TEST_PASS_CANDIDATE'?'good':'bad'}"><b>${esc(outcome.status)}</b></p><p class="note">Rezultatul este dovadă pentru BUY gate. Nu generează BUY automat.</p>`:'';
  return `<article class="card" data-run="${esc(r.runKey)}"><div class="row" style="justify-content:space-between"><div><b>${esc(roProductName(r.productName))}</b><div class="note">Run: ${esc(r.runKey)}</div></div><span class="status ${statusClass(r.status)}">${esc(r.status)}</span></div><div class="metrics" style="margin-top:10px"><div class="metric"><small>Lot planificat</small><b>${r.plannedQuantity}</b></div><div class="metric"><small>Landed/unitate</small><b>${num(r.landedPerUnit).toFixed(2)} lei</b></div><div class="metric"><small>Preț țintă</small><b>${num(r.targetSalePrice).toFixed(2)} lei</b></div><div class="metric"><small>Buget maxim</small><b>${num(r.maxTestBudget).toFixed(0)} lei</b></div></div>${start}${measure}${metrics}<div class="error" data-error></div></article>`;
}

function render(){
  const ready=products.filter(p=>p.testBuyDecision?.status==='TEST_BUY');
  $('#summary').innerHTML=`<b>${ready.length}</b> produse au autorizare reală pentru TEST în acest moment. <b>${runs.filter(x=>x.status==='RUNNING').length}</b> teste rulează și <b>${runs.filter(x=>x.status==='MEASURED').length}</b> au măsurare completă.<p class="note">FINALIST sau HOLD nu pot crea plan de test. Lotul rămâne limitat la 20–30 bucăți.</p>`;
  $('#ready').innerHTML=ready.length?ready.map(p=>{const d=p.testBuyDecision||{};return`<article class="card"><b>${esc(roProductName(p.name))}</b><div class="metrics" style="margin-top:10px"><div class="metric"><small>Gate-uri</small><b>${d.passedGates||0}/${d.gateCount||9}</b></div><div class="metric"><small>Lot</small><b>${d.quantity||'—'}</b></div><div class="metric"><small>Landed confirmat</small><b>${d.landedCostConfirmed?num(d.unitLandedCost).toFixed(2)+' lei':'NU'}</b></div><div class="metric"><small>Buget</small><b>${d.testBudget?num(d.testBudget).toFixed(0)+' lei':'—'}</b></div></div><div class="row" style="margin-top:10px"><button class="btn primary" data-plan="${esc(p.name)}">Creează plan TEST</button></div><div class="error" data-plan-error="${esc(p.name)}"></div></article>`}).join(''):'<div class="card"><b class="warn">BLOCAT CORECT</b><p>Niciun produs nu este `TEST_BUY`. Protocolul de execuție nu transformă un FINALIST în permisiune de a cheltui bani.</p></div>';
  $('#runs').innerHTML=runs.length?runs.map(runCard).join(''):'<div class="card muted">Nu există încă execuții reale.</div>';
}

async function createPlan(name){
  const p=products.find(x=>x.name===name);if(!p)return;
  const result=buildTestPlan(p,p.testBuyDecision);
  const box=document.querySelector(`[data-plan-error="${CSS.escape(name)}"]`);
  if(!result.ok){if(box)box.textContent=result.blockers.join(' · ');return;}
  if(runs.some(x=>x.productKey===result.record.productKey&&x.status!=='MEASURED')){if(box)box.textContent='Există deja un test activ/neîncheiat pentru acest produs.';return;}
  await saveTestExecution(result.record);runs=[result.record,...runs];render();
}
async function startRun(card,key){
  const r=runs.find(x=>x.runKey===key);if(!r)return;
  const result=startRealTest(r,{orderReference:card.querySelector('[data-order-ref]')?.value,confirmedRealOrder:card.querySelector('[data-order-confirm]')?.checked===true});
  if(!result.ok){card.querySelector('[data-error]').textContent=result.blockers.join(' · ');return;}
  await saveTestExecution(result.record);runs=runs.map(x=>x.runKey===key?result.record:x);render();
}
async function measureRun(card,key){
  const r=runs.find(x=>x.runKey===key);if(!r)return;
  const input={};for(const el of card.querySelectorAll('[data-f]'))input[el.dataset.f]=el.value;
  const result=measureRealTest(r,input);
  if(!result.ok){card.querySelector('[data-error]').textContent=result.blockers.join(' · ');return;}
  await saveTestExecution(result.record);runs=runs.map(x=>x.runKey===key?result.record:x);render();
}

async function boot(){
  const d=await fetch('./market-intelligence-live.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('Market intelligence indisponibil.')));
  products=await applyPrivateCommercialDecisions(d.products||[]);
  runs=await listTestExecutions();render();
}

if(hasDom){
  document.addEventListener('click',e=>{const plan=e.target.closest('[data-plan]');if(plan)createPlan(plan.dataset.plan).catch(err=>alert(err?.message||err));const start=e.target.closest('[data-start]');if(start)startRun(start.closest('[data-run]'),start.dataset.start).catch(err=>alert(err?.message||err));const measure=e.target.closest('[data-measure]');if(measure)measureRun(measure.closest('[data-run]'),measure.dataset.measure).catch(err=>alert(err?.message||err));});
  boot().catch(e=>{$('#summary').innerHTML=`<span class="bad">Test Execution indisponibil: ${esc(e?.message||e)}</span>`;});
}
