import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateFreeGoLive} from '../free-go-live-gate-v1.js';

const complete={coverage:{curatedNicheCount:25,curatedPositions:625,livePositions:625},study:{status:'PASS',participants:5,productFlowSessions:5,understandingPct:80,usefulnessPct:60,watchlistPct:80},evidence:{sourceDisplayRightsVerified:true,pilotProductFlowConfirmed:true,twoWorkspaceJourneyPassed:true,physicalPhonePassed:true,publicDomainAndRecoveryPassed:true,supportAndRestorePassed:true,criticalIssues:0}};

test('raw marketplace coverage cannot stand in for 625 reviewed generic opportunities',()=>{
  const result=evaluateFreeGoLive({...complete,coverage:{curatedNicheCount:0,curatedPositions:0,livePositions:625}});
  assert.equal(result.status,'NO_GO');
  assert.ok(result.blockers.includes('CURATED_25_X_25_REQUIRED'));
});

test('green tests without real study, phone and rights evidence remain NO_GO',()=>{
  const result=evaluateFreeGoLive({coverage:complete.coverage,study:{status:'INCOMPLETE',participants:0},evidence:{criticalIssues:0}});
  for(const code of ['SOURCE_DISPLAY_RIGHTS_UNVERIFIED','PHYSICAL_PHONE_TEST_MISSING','REAL_BETA_THRESHOLDS_UNMET'])assert.ok(result.blockers.includes(code));
  assert.equal(result.automaticLaunchAllowed,false);
});

test('all evidence clears the machine gate only for human review',()=>{
  const result=evaluateFreeGoLive(complete);
  assert.equal(result.status,'READY_FOR_HUMAN_REVIEW');
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.automaticLaunchAllowed,false);
  assert.equal(result.paidBillingEnabled,false);
});
