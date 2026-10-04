import assert from 'node:assert/strict';
import test from 'node:test';
import {FREE_TOP25_EXPANDED_IDS} from '../free-top25-expanded-registry.js';
import {evaluateFreeGoLive} from '../free-go-live-gate-v1.js';

const now=new Date('2026-09-27T09:00:00Z');
const reviewedAt='2026-09-27T08:00:00Z';
const review={reviewer:'QA reviewer',reviewedAt,evidenceUrl:'https://www.ebay.com/itm/123'};
const snapshot=nicheId=>({
  niche_id:nicheId,platform:'MPR_GENERIC',market:'EBAY_US',source_key:'EBAY_BUY_MARKETING_BEST_SELLING',
  product_count:25,source_rights_status:'APPROVED',freshness_status:'CURRENT',window_end:reviewedAt,
  products:Array.from({length:25},(_,index)=>({
    name:`Product ${index+1}`,externalId:`${nicheId}-${index+1}`,rank:index+1,sourceRank:index+1,
    sourcePlatform:'EBAY',sourceUrl:`https://www.ebay.com/itm/${1000+index}`,observedAt:reviewedAt,
    conceptKey:`${nicheId}_CONCEPT_${index+1}`,commercialGate:'GENERIC_PRIVATE_LABEL',
    brandPolicyClass:'GENERIC_PRIVATE_LABEL',brandReview:review,nicheReview:review
  }))
});
const snapshots=FREE_TOP25_EXPANDED_IDS.map(snapshot);
const marketplaceSnapshot=(nicheId,platform)=>{
  const market=platform==='EBAY'?'EBAY_US':'ALIEXPRESS_GLOBAL';
  const sourceKey=platform==='EBAY'?'EBAY_BUY_MARKETING_BEST_SELLING':'ALIEXPRESS_HOT_PRODUCTS_API';
  const sourceHost=platform==='EBAY'?'www.ebay.com':'www.aliexpress.com';
  return {niche_id:nicheId,platform,market,source_key:sourceKey,product_count:25,source_rights_status:'APPROVED',freshness_status:'CURRENT',window_end:reviewedAt,
    products:Array.from({length:25},(_,index)=>({name:`${platform} product ${index+1}`,externalId:`${platform}-${nicheId}-${index+1}`,rank:index+1,sourceUrl:`https://${sourceHost}/p/${index+1}`,observedAt:reviewedAt,sourceKey,market}))};
};
const liveSnapshots=FREE_TOP25_EXPANDED_IDS.flatMap(id=>[marketplaceSnapshot(id,'EBAY'),marketplaceSnapshot(id,'ALIEXPRESS')]);
const complete={coverage:{curatedNicheCount:25,curatedPositions:625,livePositions:1250,curatedSnapshots:snapshots,liveSnapshots},study:{status:'PASS',participants:5,productFlowSessions:5,understandingPct:80,usefulnessPct:60,watchlistPct:80},evidence:{sourceDisplayRightsVerified:true,pilotProductFlowConfirmed:true,twoWorkspaceJourneyPassed:true,physicalPhonePassed:true,publicDomainAndRecoveryPassed:true,supportAndRestorePassed:true,criticalIssues:0}};
const evaluate=input=>evaluateFreeGoLive(input,{now});

test('raw marketplace coverage cannot stand in for 625 reviewed generic opportunities',()=>{
  const result=evaluate({...complete,coverage:{curatedNicheCount:0,curatedPositions:0,livePositions:625,curatedSnapshots:[]}});
  assert.equal(result.status,'NO_GO');
  assert.ok(result.blockers.includes('CURATED_25_X_25_REQUIRED'));
});

test('aggregate counts cannot substitute for 25 distinct, valid niche snapshots',()=>{
  for(const curatedSnapshots of [[],snapshots.slice(0,24),[...snapshots.slice(0,24),snapshots[0]],snapshots.map((row,index)=>index===0?{...row,source_rights_status:'REVIEW_REQUIRED'}:row),snapshots.map((row,index)=>index===0?{...row,products:row.products.slice(0,24)}:row)]){
    const result=evaluate({...complete,coverage:{...complete.coverage,curatedSnapshots}});
    assert.ok(result.blockers.includes('CURATED_25_X_25_REQUIRED'));
  }
});

test('every niche needs two distinct current marketplace rankings, not aggregate positions',()=>{
  const oneSource=liveSnapshots.filter(row=>row.platform==='EBAY');
  const missingNiche=liveSnapshots.filter(row=>row.niche_id!==FREE_TOP25_EXPANDED_IDS[0]||row.platform==='EBAY');
  const invalidRights=liveSnapshots.map((row,index)=>index===1?{...row,source_rights_status:'REVIEW_REQUIRED'}:row);
  const legacyUnreviewed=liveSnapshots.map((row,index)=>index===1?{niche_id:`XMARKET:ALIEXPRESS:${row.niche_id}`,reviewed_at:reviewedAt,products:row.products}:row);
  for(const rows of [[],oneSource,missingNiche,invalidRights,legacyUnreviewed]){
    const result=evaluate({...complete,coverage:{...complete.coverage,liveSnapshots:rows,livePositions:1250}});
    assert.ok(result.blockers.includes('TWO_MARKETPLACES_PER_NICHE_REQUIRED'));
  }
});

test('green tests without real study, phone and rights evidence remain NO_GO',()=>{
  const result=evaluate({coverage:complete.coverage,study:{status:'INCOMPLETE',participants:0},evidence:{criticalIssues:0}});
  for(const code of ['SOURCE_DISPLAY_RIGHTS_UNVERIFIED','PHYSICAL_PHONE_TEST_MISSING','REAL_BETA_THRESHOLDS_UNMET'])assert.ok(result.blockers.includes(code));
  assert.equal(result.automaticLaunchAllowed,false);
});

test('all evidence clears the machine gate only for human review',()=>{
  const result=evaluate(complete);
  assert.equal(result.status,'READY_FOR_HUMAN_REVIEW');
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.automaticLaunchAllowed,false);
  assert.equal(result.paidBillingEnabled,false);
});

test('negative, missing or string incident counts cannot clear the launch gate',()=>{
  for(const criticalIssues of [-1,null,undefined,'0',Infinity,NaN]){
    const result=evaluate({...complete,evidence:{...complete.evidence,criticalIssues}});
    assert.ok(result.blockers.includes('CRITICAL_ISSUES_NOT_CLEARED'));
  }
});

test('impossible coverage and beta percentages cannot clear the launch gate',()=>{
  assert.ok(evaluate({...complete,coverage:{...complete.coverage,curatedNicheCount:26,curatedPositions:650}}).blockers.includes('CURATED_25_X_25_REQUIRED'));
  for(const understandingPct of [Infinity,101,'80',null])assert.ok(evaluate({...complete,study:{...complete.study,understandingPct}}).blockers.includes('REAL_BETA_THRESHOLDS_UNMET'));
  assert.ok(evaluate({...complete,study:{...complete.study,productFlowSessions:6}}).blockers.includes('REAL_BETA_THRESHOLDS_UNMET'));
});
