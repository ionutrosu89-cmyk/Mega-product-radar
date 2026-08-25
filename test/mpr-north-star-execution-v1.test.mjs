import assert from 'node:assert/strict';
import test from 'node:test';
import {recommendMprPlan} from '../plan-recommendation-v1.js';
import {calculateOpportunityV4,buildOpportunityShortlistV4} from '../opportunity-engine-v4.js';
import {evaluateNorthStarExecution,nextScaleMilestone,MPR_NORTH_STAR_TASKS} from '../mpr-north-star-execution-v1.js';

const confirmedFusion={signal:'CONFIRMED_ACCELERATION',evidenceClass:'FUSED_LONGITUDINAL_PUBLIC_TREND',trendEvidenceLevel:'RANK_PLUS_REVIEW_LONGITUDINAL',demandEvidenceConfirmed:true,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false};

test('plan finder maps each user job to the agreed commercial tier',()=>{
  assert.equal(recommendMprPlan({decisionNeed:'EXPLORE'}).code,'FREE');
  assert.equal(recommendMprPlan({decisionNeed:'VALIDATE'}).code,'DISCOVER');
  assert.equal(recommendMprPlan({decisionNeed:'TRENDS'}).code,'RADAR');
  assert.equal(recommendMprPlan({decisionNeed:'EXECUTE'}).code,'LAUNCH');
  assert.equal(recommendMprPlan({decisionNeed:'EXPLORE',chinaAgent:'YES'}).code,'LAUNCH');
  assert.match(recommendMprPlan({chinaAgent:'YES'}).reasons.join(' '),/agent China testat\/verificat/i);
});

test('Opportunity V4 follows strict funnel and never turns TEST_READY into purchase authority',()=>{
  const base={trend:{score:82,confidence:80},amazonTrendFusion:confirmedFusion,romaniaGap:{status:'READY',score:78},dataConfidence:75};
  assert.equal(calculateOpportunityV4(base).funnelStage,'VALIDATE');
  const finalist=calculateOpportunityV4({...base,supplier:{verifiedQuote:true,quoteCount:3,benchmarkConfidence:80},economics:{landedCostConfirmed:true,marginPct:30,roiPct:80,profitPerUnit:20}});
  assert.equal(finalist.funnelStage,'FINALIST');
  const ready=calculateOpportunityV4({...base,supplier:{verifiedQuote:true,quoteCount:3,benchmarkConfidence:80},economics:{landedCostConfirmed:true,marginPct:30,roiPct:80,profitPerUnit:20},testGateReady:true,complianceGateReady:true});
  assert.equal(ready.funnelStage,'TEST_READY');
  assert.equal(ready.purchaseAuthorized,false);
});

test('Opportunity V4 shortlist hard caps finalists at three',()=>{
  const rows=Array.from({length:7},(_,i)=>({productKey:`p${i}`,trend:{score:90-i,confidence:90},amazonTrendFusion:confirmedFusion,romaniaGap:{status:'READY',score:85},supplier:{verifiedQuote:true,quoteCount:3,benchmarkConfidence:80},economics:{landedCostConfirmed:true,marginPct:35,roiPct:90,profitPerUnit:22},dataConfidence:80}));
  const out=buildOpportunityShortlistV4(rows,3);
  assert.equal(out.finalists,3);
  assert.equal(out.rows.filter(x=>x.blockers.includes('FINALIST_CAP_REACHED')).length,4);
  assert.equal(out.purchaseAuthorized,false);
});

test('North Star contract exposes exactly the ten agreed tasks and fails closed on missing evidence',()=>{
  const r=evaluateNorthStarExecution({productUniverse:{uniqueProducts:1000,liveObservedProducts:255},amazonRound2:{eligibleCount:0},trend:{longitudinalProducts:0},romania:{comparableReadyNiches:0},supplier:{verifiedQuotes:0},economics:{confirmedLandedProducts:0},opportunity:{finalists:0},radar:{strictAlerts:0},launch:{completedOperationalModules:10,chinaAgentAccess:true},onboarding:{planFinderAligned:true},scale:{nextTarget:10000}});
  assert.deepEqual(Object.keys(r.tasks),MPR_NORTH_STAR_TASKS);
  assert.equal(r.tasks.DATA_FOUNDATION.status,'IN_PROGRESS');
  assert.equal(r.tasks.TREND_INTELLIGENCE.status,'BLOCKED');
  assert.equal(r.tasks.ROMANIA_GAP.status,'BLOCKED');
  assert.equal(r.tasks.ECONOMICS.status,'BLOCKED');
  assert.equal(r.tasks.OPPORTUNITY_ENGINE.status,'READY');
  assert.equal(r.tasks.ONBOARDING.status,'READY');
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.purchaseAuthorized,false);
});

test('scale advances by staged milestones and does not jump from 1K to 500K',()=>{
  assert.equal(nextScaleMilestone(1000),10000);
  assert.equal(nextScaleMilestone(10000),50000);
  assert.equal(nextScaleMilestone(50000),100000);
  assert.equal(nextScaleMilestone(100000),500000);
});
