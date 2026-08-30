import {getCurrentSession} from './supabase-client.js';
import {deriveDeploymentReadiness} from './deployment-readiness-state.js';

const $=s=>document.querySelector(s);
const ENV_KEYS=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_DISCOVER','STRIPE_PRICE_RADAR','STRIPE_PRICE_LAUNCH','SUPABASE_SERVICE_ROLE_KEY'];
const PRICE_LABELS={STRIPE_PRICE_DISCOVER:'Discover · €17,90',STRIPE_PRICE_RADAR:'Radar · €29',STRIPE_PRICE_LAUNCH:'Launch · €89'};
function pill(ok,text){return `<span class="pill ${ok?'ok':'bad'}">${text}</span>`;}
function setText(id,text,kind=''){const el=$(id);if(!el)return;el.textContent=text;el.className=kind;}
function renderConfig(configured={}){$('#configRows').innerHTML=ENV_KEYS.map(k=>`<div class="row"><code>${k}</code>${pill(Boolean(configured[k]),configured[k]?'CONFIGURAT':'LIPSEȘTE')}</div>`).join('');}
function renderPrices(prices={}){const keys=Object.keys(PRICE_LABELS);$('#priceRows').innerHTML=keys.map(k=>{const p=prices[k]||{};const valid=Boolean(p.valid&&p.active&&p.currency==='eur'&&p.recurringInterval==='month');const amount=p.unitAmount==null?'—':`€${(Number(p.unitAmount)/100).toFixed(2).replace('.',',')}`;return `<div class="row"><div><b>${PRICE_LABELS[k]}</b><div class="status">${p.configured?'Price ID configurat':'Price ID lipsă'} · ${amount} · ${(p.currency||'—').toUpperCase()} · ${p.recurringInterval||'—'} · ${p.active?'activ':'inactiv'}</div></div>${pill(valid,valid?'VALID':'INVALID')}</div>`;}).join('');}
function renderResult(data){
  renderConfig(data.configured);
  renderPrices(data.prices);
  const state=deriveDeploymentReadiness(data);
  setText('#readyState',state.technicalLabel,state.technicalReady?'ok':'bad');
  setText('#secretState',state.configured?'OK':'MISSING',state.configured?'ok':'bad');
  setText('#priceState',state.prices?'VALID':'INVALID',state.prices?'ok':'bad');
  setText('#modeState',state.modeLabel,state.stripeMode==='LIVE'?'ok':state.stripeMode==='SANDBOX'?'warn':'bad');
  setText('#sandboxVerdict',state.sandboxLabel,state.sandboxReady?'ok':'bad');
  setText('#liveVerdict',state.liveBillingLabel,state.liveBillingReady?'ok':'bad');
  $('#status').textContent=state.status;
}

async function run(){const button=$('#runCheck');button.disabled=true;$('#status').textContent='Verific deployment-ul…';try{const session=await getCurrentSession();if(!session?.access_token){location.href='login.html?next=deployment-readiness.html';return;}const r=await fetch('/api/internal/billing-readiness',{headers:{authorization:`Bearer ${session.access_token}`,'cache-control':'no-cache'}});let data={};try{data=await r.json();}catch{}if(!r.ok)throw new Error(data.error||`Readiness check failed (${r.status})`);renderResult(data);}catch(error){$('#status').textContent=error.message||'Verificarea nu a putut fi executată.';setText('#readyState','BLOCKED','bad');setText('#modeState','UNKNOWN','bad');setText('#sandboxVerdict','NO-GO','bad');setText('#liveVerdict','NO-GO','bad');}finally{button.disabled=false;}}

renderConfig({});$('#runCheck').addEventListener('click',run);run();
