import test from 'node:test';
import assert from 'node:assert/strict';
import {buildImportabilityBusinessFit} from '../importability-business-fit-gate-v1.js';

const good={candidateAsin:'B00INKVS82',facts:{productTypeConfirmed:true,isLiquid:false,hasBattery:false,regulatedOrSpecialAuthorization:false,airFreightSuitable:true,unitWeightKg:0.8,weightConfirmed:true,packedVolumeCm3:8000,dimensionsConfirmed:true,estimatedAcquisitionCostRon:30,targetSalePriceRon:120}};

test('passes only complete same-candidate importability facts',()=>{
 const r=buildImportabilityBusinessFit({candidateAsin:'B00INKVS82',profile:good});
 assert.equal(r.status,'IMPORTABILITY_PASS'); assert.equal(r.importabilityPassed,true); assert.equal(r.grossMultiple,4); assert.equal(r.purchaseAuthorized,false);
});

test('fails closed when facts are missing',()=>{
 const r=buildImportabilityBusinessFit({candidateAsin:'B00INKVS82',profile:{candidateAsin:'B00INKVS82',facts:{}}});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED'); assert.equal(r.importabilityPassed,false); assert.ok(r.unknowns.length>0);
});

test('blocks liquid or oversized products',()=>{
 const p=structuredClone(good); p.facts.isLiquid=true; p.facts.packedVolumeCm3=20000;
 const r=buildImportabilityBusinessFit({candidateAsin:'B00INKVS82',profile:p});
 assert.equal(r.status,'IMPORTABILITY_BLOCKED'); assert.ok(r.hardBlockers.includes('LIQUID_PRODUCT')); assert.ok(r.hardBlockers.includes('PACKED_VOLUME_ABOVE_15000CM3'));
});

test('does not reuse another candidates facts',()=>{
 const p=structuredClone(good); p.candidateAsin='OTHER';
 const r=buildImportabilityBusinessFit({candidateAsin:'B00INKVS82',profile:p});
 assert.equal(r.sameCandidate,false); assert.equal(r.status,'UNKNOWN_FAIL_CLOSED'); assert.equal(r.importabilityPassed,false);
});

test('battery and sub-3x gross multiple require review rather than silent pass',()=>{
 const p=structuredClone(good); p.facts.hasBattery=true; p.facts.estimatedAcquisitionCostRon=50; p.facts.targetSalePriceRon=120;
 const r=buildImportabilityBusinessFit({candidateAsin:'B00INKVS82',profile:p});
 assert.equal(r.status,'IMPORTABILITY_REVIEW'); assert.ok(r.warnings.includes('BATTERY_LOGISTICS_REVIEW_REQUIRED')); assert.ok(r.warnings.includes('TARGET_GROSS_MULTIPLE_BELOW_3X'));
});
