import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFreeBetaScorecardV1,FREE_BETA_TARGETS} from '../free-beta-scorecard-v1.js';

const start='2026-09-02T10:00:00Z';
const after=(minutes=1)=>new Date(Date.parse(start)+minutes*60000).toISOString();
const cohort=()=>Array.from({length:25},(_,index)=>({id:`p${index}`,status:index<15?'ACTIVATED':'INVITED',user_id:index<15?`u${index}`:null,workspace_id:index<15?`w${index}`:null,activated_at:index<15?start:null}));

test('Free Beta scorecard targets match the zero-cost operating plan',()=>{
  assert.deepEqual(FREE_BETA_TARGETS,{invitedUsers:25,activatedUsers:15,onboardingUsers:10,top25SearchUsers:8,productDecisionUsers:5,feedbackUsers:5,willingnessToPayUsers:3,willingnessToPayRatePct:20,decisionChangingUsers:3,criticalIncidents:0});
});

test('an empty real cohort remains BUILD_COHORT without synthetic demand',()=>{
  const scorecard=buildFreeBetaScorecardV1();
  assert.equal(scorecard.status,'BUILD_COHORT');
  assert.equal(scorecard.metrics.invitedUsers.value,0);
  assert.equal(scorecard.metrics.willingnessToPay.status,'UNKNOWN');
  assert.equal(scorecard.purchaseAuthorized,false);
  assert.equal(scorecard.automaticLaunchAllowed,false);
});

test('all nine zero-cost validation gates are derived from linked cohort evidence',()=>{
  const participants=cohort(),events=[],feedback=[];
  for(let index=0;index<15;index++){
    if(index<10)events.push({workspace_id:`w${index}`,event_name:'ONBOARDING_COMPLETED',created_at:after(1),metadata:{}});
    if(index<8)events.push({workspace_id:`w${index}`,event_name:'TOP25_SEARCHED',created_at:after(2),metadata:{nicheId:'auto'}});
    if(index<5){events.push({workspace_id:`w${index}`,event_name:'PRODUCT_OPENED',created_at:after(3),metadata:{}});events.push({workspace_id:`w${index}`,event_name:'DECISION_REACHED',created_at:after(4),metadata:{decision:'INVESTIGATE'}});}
    if(index<5)feedback.push({workspace_id:`w${index}`,user_id:`u${index}`,would_pay:index<3,created_at:after(5),metadata:{decisionChanged:index<3}});
  }
  const scorecard=buildFreeBetaScorecardV1({participants,events,feedback,now:after(10)});
  assert.equal(scorecard.status,'FREE_BETA_TARGETS_MET');
  assert.equal(scorecard.metrics.willingnessToPay.value,3);
  assert.equal(scorecard.metrics.willingnessToPay.ratePct,20);
  assert.equal(scorecard.metrics.criticalIncidents.status,'PASS');
  assert.equal(scorecard.investmentDecision,'ELIGIBLE_FOR_HUMAN_INVESTMENT_REVIEW');
  assert.equal(scorecard.purchaseAuthorized,false);
});

test('events before activation and workspaces outside the cohort cannot contaminate demand KPIs',()=>{
  const participants=cohort();
  const events=[
    {workspace_id:'w0',event_name:'TOP25_SEARCHED',created_at:'2026-09-01T10:00:00Z',metadata:{}},
    {workspace_id:'outside',event_name:'DECISION_REACHED',created_at:after(1),metadata:{}}
  ];
  const feedback=[{workspace_id:'outside',would_pay:true,created_at:after(2),metadata:{decisionChanged:true}}];
  const scorecard=buildFreeBetaScorecardV1({participants,events,feedback,now:after(5)});
  assert.equal(scorecard.metrics.top25SearchUsers.value,0);
  assert.equal(scorecard.metrics.productDecisionUsers.value,0);
  assert.equal(scorecard.metrics.feedbackUsers.value,0);
  assert.equal(scorecard.metrics.willingnessToPay.status,'UNKNOWN');
});

test('one critical incident blocks a fully used beta',()=>{
  const participants=cohort();
  const events=[{workspace_id:'w0',event_name:'CRITICAL_INCIDENT_RECORDED',created_at:after(1),metadata:{}}];
  const scorecard=buildFreeBetaScorecardV1({participants,events,feedback:[],now:after(2)});
  assert.equal(scorecard.metrics.criticalIncidents.status,'FAIL');
  assert.ok(scorecard.failed.includes('criticalIncidents'));
  assert.notEqual(scorecard.status,'FREE_BETA_TARGETS_MET');
});
