import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {readinessView} from '../beta-ops.js';

function analytics(){return {totals:{activeWorkspaces:1,activeUsers:1,activePaidWorkspaces:1,checkoutCompletedWorkspaces:1,subscriptionActivatedWorkspaces:1,cancelPendingWorkspaces:0},usageFunnel:[{key:'home',workspaces:1},{key:'discover',workspaces:1}]};}

test('sandbox may be beta technically ready but never public-launch billing ready',()=>{
  const view=readinessView({analytics:analytics(),billing:{ready:true,stripeMode:'SANDBOX',publicLaunchBillingReady:false}});
  assert.equal(view.betaReady,true);
  assert.equal(view.publicBillingReady,false);
  assert.equal(view.stripeLive,false);
  assert.ok(view.gates.some(x=>x.title==='Stripe environment'&&x.label==='SANDBOX'));
});

test('public billing readiness still leaves manual launch gates required',()=>{
  const view=readinessView({analytics:analytics(),billing:{ready:true,stripeMode:'LIVE',publicLaunchBillingReady:true}});
  assert.equal(view.publicBillingReady,true);
  assert.equal(view.manualRequired,true);
});

test('beta readiness fails closed when real journey or billing evidence is missing',()=>{
  const a=analytics();a.totals.checkoutCompletedWorkspaces=0;a.totals.subscriptionActivatedWorkspaces=0;
  const view=readinessView({analytics:a,billing:{ready:true,stripeMode:'SANDBOX',publicLaunchBillingReady:false}});
  assert.equal(view.betaReady,false);
});

test('Beta Ops dashboard uses authenticated internal endpoints and ships in build',async()=>{
  const html=await readFile(new URL('../beta-ops.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../beta-ops.js',import.meta.url),'utf8');
  const build=await readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  assert.match(html,/Launch Readiness/);
  assert.match(html,/Gate-uri manuale/);
  assert.match(js,/\/api\/internal\/beta-analytics/);
  assert.match(js,/\/api\/internal\/billing-readiness/);
  assert.match(js,/authorization:`Bearer/);
  assert.match(build,/beta-ops\.html/);
  assert.match(build,/BETA_LAUNCH_CHECKLIST\.md/);
  assert.doesNotMatch(js,/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/);
});
