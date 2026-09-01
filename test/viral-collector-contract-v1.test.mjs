import assert from 'node:assert/strict';
import test from 'node:test';
import {buildViralPilotReport,normalizeViralObservation} from '../viral-collector-contract.js';

const row={platform:'TIKTOK',countryCode:'US',externalId:'x',sourceUrl:'https://example.com/x',observedAt:'2026-08-31T00:00:00Z',conceptName:'Portable Paw Cleaner',category:'Pet Care',evidenceClass:'DIRECT',metrics:{viewCount:10}};
test('source is held until access policy is approved and enabled',()=>{
  const out=normalizeViralObservation(row,{termsApproved:false,enabled:false});
  assert.equal(out.ingestEligible,false);assert.equal(out.holdReason,'TERMS_REVIEW_REQUIRED');
});
test('approved direct evidence is eligible but never authorizes purchase',()=>{
  const out=normalizeViralObservation(row,{termsApproved:true,enabled:true});
  assert.equal(out.ingestEligible,true);assert.equal(out.purchaseAuthorized,false);assert.equal(out.providerDataSpendEur,0);
});
test('Romania absence is not converted into scarcity',()=>{
  const rows=[row,{...row,platform:'GOOGLE_TRENDS',countryCode:'GB',externalId:'g',sourceUrl:'https://example.com/g'}];
  const report=buildViralPilotReport(rows,{sourcePolicies:{TIKTOK:{termsApproved:true,enabled:true},GOOGLE_TRENDS:{termsApproved:true,enabled:true}}});
  assert.equal(report.policy.romaniaMissingAsScarcity,false);
  assert.equal(report.candidates[0].signal.eligibleForCommercialValidation,false);
});
test('invalid provenance fails closed',()=>assert.throws(()=>normalizeViralObservation({...row,sourceUrl:'not-a-url'},{termsApproved:true,enabled:true}),/DIRECT_SOURCE_URL_REQUIRED/));
