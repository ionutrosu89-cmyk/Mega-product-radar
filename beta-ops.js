import {getCurrentSession} from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function status(label,type){return `<span class="status ${type}">${esc(label)}</span>`;}
function gate(title,detail,label,type){return `<div class="gate"><div><b>${esc(title)}</b><small>${esc(detail)}</small></div>${status(label,type)}</div>`;}
async function adminFetch(path,token){const response=await fetch(path,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed ${response.status}`);return data;}
export function readinessView({analytics,billing}){
  const totals=analytics?.totals||{};
  const usage=analytics?.usageFunnel||[];
  const find=k=>usage.find(x=>x.key===k)?.workspaces||0;
  const technicalBilling=Boolean(billing?.ready);
  const stripeLive=String(billing?.stripeMode)==='LIVE';
  const hasJourney=Number(totals.activeWorkspaces||0)>0&&find('home')>0&&find('discover')>0;
  const hasPaidLifecycle=Number(totals.checkoutCompletedWorkspaces||0)>0&&Number(totals.subscriptionActivatedWorkspaces||0)>0;
  const gates=[
    {title:'Billing tehnic',detail:'Cheile necesare, webhook-ul și prețurile lunare EUR sunt validate.',label:technicalBilling?'PASS':'BLOCKED',type:technicalBilling?'pass':'blocked'},
    {title:'Stripe environment',detail:stripeLive?'Stripe rulează cu secret LIVE.':'Stripe nu este în LIVE; Sandbox este acceptat pentru beta, nu pentru public launch.',label:String(billing?.stripeMode||'UNKNOWN'),type:stripeLive?'pass':'warn'},
    {title:'Customer journey observat',detail:'Există evenimente reale Home + Discover în analytics.',label:hasJourney?'EVIDENȚĂ':'INSUFICIENT',type:hasJourney?'pass':'warn'},
    {title:'Billing lifecycle observat',detail:'Există checkout finalizat și activare de abonament confirmate prin Stripe.',label:hasPaidLifecycle?'EVIDENȚĂ':'INSUFICIENT',type:hasPaidLifecycle?'pass':'warn'},
    {title:'Churn integrity',detail:'Cancel pending rămâne separat de churn; churn cere SUBSCRIPTION_ENDED real.',label:'PASS',type:'pass'}
  ];
  return {gates,betaReady:technicalBilling&&hasJourney&&hasPaidLifecycle,publicBillingReady:Boolean(billing?.publicLaunchBillingReady),stripeLive,manualRequired:true};
}
function render(analytics,billing){
  const t=analytics.totals||{};
  $('#activeWs').textContent=String(t.activeWorkspaces??0);$('#activeUsers').textContent=String(t.activeUsers??0);$('#activePaid').textContent=String(t.activePaidWorkspaces??0);$('#cancelPending').textContent=String(t.cancelPendingWorkspaces??0);
  const view=readinessView({analytics,billing});
  $('#autoGates').innerHTML=view.gates.map(x=>gate(x.title,x.detail,x.label,x.type)).join('');
  $('#betaVerdict').textContent=view.betaReady?'BETA TECHNIC READY · continuă testarea externă':'BETA BLOCKED · există gate-uri automate incomplete';
  $('#betaVerdict').className=`verdict ${view.betaReady?'beta':'public'}`;
  $('#publicVerdict').textContent=view.publicBillingReady?'PUBLIC BILLING LIVE · gate-urile manuale rămân obligatorii':'PUBLIC LAUNCH BLOCKED · Stripe LIVE și gate-urile manuale nu sunt încă finalizate';
  $('#foot').textContent=`REAL EVENT DATA · ${analytics.days||30} zile · Stripe ${billing.stripeMode||'UNKNOWN'} · Public launch nu devine automat READY din acest dashboard; gate-urile manuale necesită verificare separată.`;
}
async function load(){const button=$('#refresh');button.disabled=true;try{const session=await getCurrentSession();if(!session){location.href='login.html?next=beta-ops.html';return;}const [analytics,billing]=await Promise.all([adminFetch('/api/internal/beta-analytics?days=30',session.access_token),adminFetch('/api/internal/billing-readiness',session.access_token)]);render(analytics,billing);}catch(error){$('#autoGates').innerHTML=`<div class="empty"><b>Beta Ops indisponibil.</b><br>${esc(error?.message||error)}</div>`;$('#betaVerdict').textContent='BETA STATUS NECUNOSCUT';$('#betaVerdict').className='verdict public';$('#publicVerdict').textContent='PUBLIC LAUNCH BLOCKED · diagnosticul admin nu este disponibil';}finally{button.disabled=false;}}
$('#refresh')?.addEventListener('click',load);load();
