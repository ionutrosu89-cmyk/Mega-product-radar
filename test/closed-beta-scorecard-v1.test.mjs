import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClosedBetaScorecardV1,CLOSED_BETA_TARGETS} from '../closed-beta-scorecard-v1.js';

const now='2026-08-26T12:00:00Z';
const day=n=>new Date(Date.parse(now)-n*86400000).toISOString();

function cohort(count=10){return Array.from({length:count},(_,i)=>({id:`p${i}`,status:i<8?'ACTIVATED':'INVITED',workspace_id:i<8?`w${i}`:null,activated_at:i<8?day(35):null}));}

test('P10 canonical targets match the master plan',()=>{
  assert.equal(CLOSED_BETA_TARGETS.participantMin,10);
  assert.equal(CLOSED_BETA_TARGETS.participantMax,15);
  assert.equal(CLOSED_BETA_TARGETS.activationRatePct,70);
  assert.equal(CLOSED_BETA_TARGETS.firstUsefulOpportunityMinutes,10);
  assert.equal(CLOSED_BETA_TARGETS.wauRatePct,50);
  assert.equal(CLOSED_BETA_TARGETS.usefulOpportunityRatePct,70);
  assert.equal(CLOSED_BETA_TARGETS.falsePositiveRatePct,20);
  assert.equal(CLOSED_BETA_TARGETS.romaniaGapUsefulRatePct,70);
  assert.equal(CLOSED_BETA_TARGETS.willingnessToPay29RatePct,30);
  assert.equal(CLOSED_BETA_TARGETS.week4RetentionRatePct,40);
});

test('missing evidence remains UNKNOWN instead of synthetic zero',()=>{
  const scorecard=buildClosedBetaScorecardV1({participants:cohort(),events:[],feedback:[],now});
  assert.equal(scorecard.metrics.activationRate.value,80);
  assert.equal(scorecard.metrics.firstUsefulOpportunityMinutes.value,null);
  assert.equal(scorecard.metrics.firstUsefulOpportunityMinutes.status,'UNKNOWN');
  assert.equal(scorecard.metrics.usefulOpportunityRate.value,null);
  assert.equal(scorecard.metrics.willingnessToPay29Rate.value,null);
  assert.equal(scorecard.status,'MEASURING');
});

test('cohort outside 10-15 fails closed to BUILD_COHORT',()=>{
  const scorecard=buildClosedBetaScorecardV1({participants:cohort(8),events:[],feedback:[],now});
  assert.equal(scorecard.cohortReady,false);
  assert.equal(scorecard.status,'BUILD_COHORT');
});

test('explicit usefulness, false positives, Romania Gap and €29 signals are measured directly',()=>{
  const participants=cohort();
  const events=[];
  for(let i=0;i<8;i++){
    events.push({workspace_id:`w${i}`,event_name:'HOME_VIEW',created_at:day(2),metadata:{}});
    events.push({workspace_id:`w${i}`,event_name:'BETA_OPPORTUNITY_RATED',created_at:new Date(Date.parse(participants[i].activated_at)+5*60000).toISOString(),metadata:{useful:i<7,falsePositive:i===7}});
    events.push({workspace_id:`w${i}`,event_name:'RADAR_VIEW',created_at:new Date(Date.parse(participants[i].activated_at)+24*86400000).toISOString(),metadata:{}});
  }
  const feedback=Array.from({length:10},(_,i)=>({area:'ROMANIA_GAP',rating:i<8?4:3,metadata:{wouldPay29:i<4}}));
  const scorecard=buildClosedBetaScorecardV1({participants,events,feedback,now});
  assert.equal(scorecard.metrics.activationRate.status,'PASS');
  assert.equal(scorecard.metrics.firstUsefulOpportunityMinutes.value,5);
  assert.equal(scorecard.metrics.firstUsefulOpportunityMinutes.status,'PASS');
  assert.equal(scorecard.metrics.wauRate.value,100);
  assert.equal(scorecard.metrics.usefulOpportunityRate.value,87.5);
  assert.equal(scorecard.metrics.falsePositiveRate.value,12.5);
  assert.equal(scorecard.metrics.romaniaGapUsefulRate.value,80);
  assert.equal(scorecard.metrics.willingnessToPay29Rate.value,40);
  assert.equal(scorecard.metrics.week4RetentionRate.value,100);
  assert.equal(scorecard.status,'BETA_TARGETS_MET');
  assert.equal(scorecard.automaticLaunchAllowed,false);
  assert.equal(scorecard.purchaseAuthorized,false);
});

test('high usefulness cannot hide a failed false-positive target',()=>{
  const participants=cohort();
  const events=Array.from({length:8},(_,i)=>({workspace_id:`w${i}`,event_name:'BETA_OPPORTUNITY_RATED',created_at:new Date(Date.parse(participants[i].activated_at)+5*60000).toISOString(),metadata:{useful:true,falsePositive:i<2}}));
  const scorecard=buildClosedBetaScorecardV1({participants,events,feedback:[],now});
  assert.equal(scorecard.metrics.falsePositiveRate.value,25);
  assert.equal(scorecard.metrics.falsePositiveRate.status,'FAIL');
  assert.ok(scorecard.failed.includes('falsePositiveRate'));
});
