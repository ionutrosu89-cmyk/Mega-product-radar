import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeImportabilityV2} from '../importability-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const ev=value=>({value,evidenceClass:'MANUALLY_VERIFIED',observedAt:'2026-08-26T10:00:00Z',source:'MANUAL_REVIEW'});
const goodFacts=()=>({
 productType:ev('OFFICE_BINDER'),isLiquid:ev(false),regulatedOrSpecialAuthorization:ev(false),dangerousGoods:ev(false),airFreightSuitable:ev(true),unitWeightKg:ev(0.7),packedDimensionsCm:ev({length:32,width:29,height:7}),hasBattery:ev(false)
});

test('complete strong evidence passes clean importability',()=>{
 const r=analyzeImportabilityV2({canonicalProductId:A,facts:goodFacts(),now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'PASS');assert.equal(r.importabilityPassed,true);assert.equal(r.purchaseAuthorized,false);
});

test('critical unknown fails closed even if every known fact looks safe',()=>{
 const facts=goodFacts();delete facts.unitWeightKg;
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.unknowns.includes('UNITWEIGHTKG_UNKNOWN'));
});

test('weak heuristic evidence cannot satisfy critical fact',()=>{
 const facts=goodFacts();facts.isLiquid={value:false,evidenceClass:'HEURISTIC',observedAt:'2026-08-26T10:00:00Z',source:'TITLE_HEURISTIC'};
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.evidenceProblems.includes('ISLIQUID_WEAK_EVIDENCE'));
});

test('liquid is a hard blocker regardless of other positive facts',()=>{
 const facts=goodFacts();facts.isLiquid=ev(true);
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'BLOCKED');assert.ok(r.hardBlockers.includes('LIQUID_PRODUCT'));
});

test('regulated or dangerous goods block',()=>{
 const facts=goodFacts();facts.dangerousGoods=ev(true);
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'BLOCKED');assert.ok(r.hardBlockers.includes('DANGEROUS_GOODS'));
});

test('weight and packed volume limits are hard constraints',()=>{
 const facts=goodFacts();facts.unitWeightKg=ev(2.1);facts.packedDimensionsCm=ev({length:50,width:40,height:10});
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'BLOCKED');assert.ok(r.hardBlockers.includes('UNIT_WEIGHT_ABOVE_LIMIT'));assert.ok(r.hardBlockers.includes('PACKED_VOLUME_ABOVE_LIMIT'));
});

test('battery can be review without becoming automatic blocker',()=>{
 const facts=goodFacts();facts.hasBattery=ev(true);
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'REVIEW');assert.ok(r.softRisks.includes('BATTERY_LOGISTICS_REVIEW_REQUIRED'));
});

test('missing canonical identity fails closed',()=>{
 const r=analyzeImportabilityV2({facts:goodFacts(),now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.equal(r.decisionEligible,false);
});

test('stale critical evidence cannot silently pass',()=>{
 const facts=goodFacts();facts.unitWeightKg={...facts.unitWeightKg,observedAt:'2025-01-01T00:00:00Z'};
 const r=analyzeImportabilityV2({canonicalProductId:A,facts,now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');assert.ok(r.evidenceProblems.includes('UNITWEIGHTKG_STALE_EVIDENCE'));
});
