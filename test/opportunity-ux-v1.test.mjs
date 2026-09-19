import test from 'node:test';
const stagePacket={stagePolicyVersion:'MPR_EVIDENCE_STAGES_V1',stageFacts:{promising:true,marketQualified:true,confidence:80,trendConfirmed:true,romaniaExact:true,supplierVerified:true,economicsConfirmed:true,importabilityPassed:true,fresh:true},evidenceObservedAt:Object.fromEntries(['trend','romaniaGap','supplier','economics','importability'].map(k=>[k,new Date().toISOString()]))};
import assert from 'node:assert/strict';
import {normalizeOpportunityUxV1,nextValidationStepV1,opportunityActionStorageKeyV1,isCanonicalFinalistV1} from '../opportunity-ux-v1.js';

const components=status=>({globalDemand:{status:'PASS',score:80,confidence:80},trend:{status,score:80,confidence:80},romaniaGap:{status:'PASS',score:80,confidence:80},importability:{status:'PASS',score:100,confidence:80},supplier:{status:'PASS',score:80,confidence:80},economics:{status:'PASS',score:80,confidence:80},evidence:{status:'DERIVED',score:80,confidence:80}});
const productWith=(overrides={})=>({id:'row-1',name:'Candidate',canonicalProductId:'cp-1',opportunityV5:{...stagePacket,canonicalProductId:'cp-1',opportunityScore:80,confidence:80,recommendation:'FINALIST',finalistEligible:true,components:components('PASS'),blockers:[],missingComponents:[],identityMismatches:[],...overrides}});

test('missing Opportunity V5 remains unknown and DISCOVERED; legacy BUY is ignored',()=>{
  const view=normalizeOpportunityUxV1({id:'x',name:'Legacy winner',canonicalProductId:'cp-x',testBuyDecision:{commercialAction:'BUY',verdict:'BUY'}});
  assert.equal(view.recommendation,'DISCOVERED');
  assert.equal(view.opportunityScore,null);
  assert.equal(view.components.romaniaGap.status,'UNKNOWN');
  assert.equal(view.legacyRecommendationAuthoritative,false);
  assert.ok(view.blockers.includes('OPPORTUNITY_V5_MISSING'));
});

test('score and confidence remain separate',()=>{
  const view=normalizeOpportunityUxV1(productWith({opportunityScore:95,confidence:61}));
  assert.equal(view.opportunityScore,95);
  assert.equal(view.confidence,61);
});

test('Romania Gap REVIEW cannot be represented as canonical FINALIST',()=>{
  const p=productWith({opportunityScore:95,recommendation:'VALIDATE',finalistEligible:false,components:{...components('PASS'),romaniaGap:{status:'REVIEW',score:95,confidence:90}}});
  const view=normalizeOpportunityUxV1(p);
  assert.equal(view.recommendation,'PROMISING');
  assert.equal(isCanonicalFinalistV1(view),false);
  assert.equal(nextValidationStepV1(view).component,'romaniaGap');
});

test('a BLOCKED critical gate overrides a high score',()=>{
  const p=productWith({opportunityScore:100,recommendation:'VALIDATE',finalistEligible:false,components:{...components('PASS'),importability:{status:'BLOCKED',score:0,confidence:95}},blockers:['IMPORTABILITY_BLOCKED']});
  const view=normalizeOpportunityUxV1(p);
  assert.equal(isCanonicalFinalistV1(view),false);
  assert.equal(nextValidationStepV1(view).component,'importability');
  assert.match(nextValidationStepV1(view).reason,/BLOCKED/);
});

test('FINALIST is accepted only when canonical pre-test gates pass',()=>{
  const view=normalizeOpportunityUxV1(productWith());
  assert.equal(isCanonicalFinalistV1(view),true);
  assert.equal(view.testReadyEligible,false);
  assert.equal(view.buyReadyEligible,false);
  assert.equal(view.purchaseAuthorized,false);
  assert.equal(view.automaticPurchaseAllowed,false);
});

test('missing canonical identity is surfaced and UX fallback key is not decision identity',()=>{
  const p={id:'ROW 42',name:'Candidate',opportunityV5:{opportunityScore:75,confidence:75,recommendation:'VALIDATE',components:components('PASS')}};
  const view=normalizeOpportunityUxV1(p);
  assert.equal(view.canonicalProductId,null);
  assert.ok(view.blockers.includes('CANONICAL_PRODUCT_ID_REQUIRED'));
  assert.equal(nextValidationStepV1(view).component,'identity');
  assert.match(opportunityActionStorageKeyV1(p,view),/:ux-only:/);
});

test('canonical action key uses canonicalProductId',()=>{
  const p=productWith();
  const view=normalizeOpportunityUxV1(p);
  assert.equal(opportunityActionStorageKeyV1(p,view),'mprOpportunityActionV1:cp-1');
});

test('cached FINALIST labels without current policy evidence cannot remain finalist in UI',()=>{
 for(const overrides of [{stageFacts:null},{stagePolicyVersion:'OLD'},{evidenceObservedAt:{}}]){
  const view=normalizeOpportunityUxV1(productWith(overrides));
  assert.equal(isCanonicalFinalistV1(view),false);assert.notEqual(view.recommendation,'FINALIST');
 }
});
