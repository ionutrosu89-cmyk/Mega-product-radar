import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOpportunityPackGate,OpportunityPackGateTruthPolicy} from '../opportunity-pack-gate-v1.js';
const ready={supplier:{externalId:'1600756221959',supplierName:'Koyo',unitPriceUsd:10.66,moq:1000},directSupplierEvidence:{provenanceMatched:true,assembledDimensionsCm:{length:35,width:30,height:28},exactConfigurationConfirmed:true},match:{matchConfidence:82,screeningEconomicsEligible:true,hardMismatches:[]},romaniaPrice:{grossRon:139,evidenceClass:'DIRECT_CURRENT_RO_PRICE'},freight:{usdPerKg:4.71}};
test('blocks current pilot while direct dimensions and match confidence are missing',()=>{
 const x=buildOpportunityPackGate({supplier:{externalId:'1600756221959',unitPriceUsd:10.66,moq:1000},directSupplierEvidence:{provenanceMatched:true,exactConfigurationConfirmed:true},match:{matchConfidence:65.37,screeningEconomicsEligible:false,hardMismatches:[]},romaniaPrice:{grossRon:90,evidenceClass:'SECONDARY_SCREENING_PRICE'},freight:{usdPerKg:4.71}});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.blockers.includes('DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'));
 assert.ok(x.blockers.includes('MATCH_CONFIDENCE_80_REQUIRED'));
 assert.equal(x.economicsAllowed,false);
});
test('becomes economics ready only after all required gates pass',()=>{
 const x=buildOpportunityPackGate(ready);
 assert.equal(x.status,'ECONOMICS_READY');
 assert.deepEqual(x.blockers,[]);
 assert.equal(x.economicsAllowed,true);
 assert.equal(x.rankingScenario,'CONSERVATIVE');
});
test('hard mismatch blocks economics even above threshold',()=>{
 const x=buildOpportunityPackGate({...ready,match:{matchConfidence:95,screeningEconomicsEligible:true,hardMismatches:['DIMENSION_MISMATCH']}});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.blockers.includes('MATCH_HARD_MISMATCH'));
 assert.equal(OpportunityPackGateTruthPolicy.purchaseAuthorized,false);
});
