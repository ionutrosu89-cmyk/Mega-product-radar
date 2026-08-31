import assert from 'node:assert/strict';
import test from 'node:test';
import {launchPassEvidence,REQUIRED_CHECKS,serverBillingAcceptanceReady,summarize} from '../netlify/functions/launch-readiness.mjs';

function serverGo(){return {status:'GO',checkpoint_count:6,verdict:{ok:true,verdict:'GO'}};}

test('public launch registry now requires BILLING_E2E',()=>{
  assert.ok(REQUIRED_CHECKS.includes('BILLING_E2E'));
  const rows=REQUIRED_CHECKS.filter(code=>code!=='BILLING_E2E').map(check_code=>({check_code,status:'PASS',evidence_note:'verified evidence',verified_at:'2026-08-30T10:00:00Z'}));
  const summary=summarize(rows);
  assert.equal(summary.allManualPassed,false);
  assert.equal(summary.total,8);
  assert.equal(summary.checks.find(row=>row.checkCode==='BILLING_E2E').status,'BLOCKED');
});

test('generic or client-supplied billing evidence cannot manually PASS BILLING_E2E',()=>{
  const result=launchPassEvidence('BILLING_E2E',{evidenceNote:'trust me, sandbox passed',billingJourneyEvidence:{schema:'MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1'}});
  assert.equal(result.ok,false);
});

test('server-owned complete current-deployment acceptance can produce BILLING_E2E PASS evidence',()=>{
  const acceptance=serverGo();
  assert.equal(serverBillingAcceptanceReady(acceptance),true);
  const result=launchPassEvidence('BILLING_E2E',{serverBillingAcceptance:acceptance});
  assert.equal(result.ok,true);
  assert.match(result.note,/MPR_SERVER_BILLING_E2E_GO/);
});

test('incomplete or unverified server acceptance cannot produce launch PASS evidence',()=>{
  assert.equal(serverBillingAcceptanceReady({status:'GO',checkpoint_count:5,verdict:{ok:true,verdict:'GO'}}),false);
  assert.equal(serverBillingAcceptanceReady({status:'GO',checkpoint_count:6,verdict:{ok:false,verdict:'NO-GO'}}),false);
  assert.equal(launchPassEvidence('BILLING_E2E',{serverBillingAcceptance:{status:'IN_PROGRESS',checkpoint_count:6,verdict:{ok:true,verdict:'GO'}}}).ok,false);
});

test('stored BILLING_E2E PASS is downgraded when current deployment has no server GO',()=>{
  const rows=REQUIRED_CHECKS.map(check_code=>({check_code,status:'PASS',evidence_note:'old evidence',verified_at:'2026-08-30T10:00:00Z'}));
  const blocked=summarize(rows,{billingE2eCurrent:false});
  assert.equal(blocked.allManualPassed,false);
  assert.equal(blocked.checks.find(row=>row.checkCode==='BILLING_E2E').status,'BLOCKED');
  const current=summarize(rows,{billingE2eCurrent:true});
  assert.equal(current.allManualPassed,true);
});
