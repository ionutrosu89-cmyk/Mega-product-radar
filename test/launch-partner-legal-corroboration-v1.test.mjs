import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../data/launch-partner-legal-corroboration-v1.json',import.meta.url),'utf8'));

test('M3Cargo legal identity may be corroborated without service verification',()=>{
 const x=data.records.find(r=>r.partnerKey==='M3CARGO');
 assert.equal(x.legalIdentityCorroborated,true);
 assert.equal(x.serviceQualityVerified,false);
 assert.equal(x.chinaPresenceVerified,false);
 assert.equal(x.mprVerified,false);
 assert.equal(x.testedByMpr,false);
});

test('ROMASIA importer model remains a first-party contractual claim',()=>{
 const x=data.records.find(r=>r.partnerKey==='ROMASIA');
 assert.equal(x.evidenceClass,'FIRST_PARTY_IMPORTER_MODEL_CLAIM');
 assert.equal(x.importerModelVerifiedContractually,false);
 assert.equal(x.mprVerified,false);
});

test('corroboration audit remains zero-cost and non-purchasing',()=>{
 assert.equal(data.summary.externalMessagesSent,0);
 assert.equal(data.summary.paidCallsTriggered,0);
 assert.equal(data.summary.purchaseAuthorized,false);
 assert.equal(data.summary.mprVerified,0);
});
