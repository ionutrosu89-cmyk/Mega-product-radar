import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../data/launch-partner-document-request-pack-v1.json',import.meta.url),'utf8'));

test('request pack targets only the first two due-diligence priorities',()=>{
 assert.deepEqual(data.targets.map(x=>x.partnerKey),['M3CARGO','ROMASIA']);
 assert.deepEqual(data.targets.map(x=>x.priority),[1,2]);
});

test('document review never skips real service test and manual approval',()=>{
 assert.ok(data.acceptanceRules.MPR_VERIFIED.includes('test service completed'));
 assert.ok(data.acceptanceRules.MPR_VERIFIED.includes('manual MPR approval'));
 for(const x of data.targets){
  assert.equal(x.realServiceTestBeforeApproval.required,true);
  assert.equal(x.realServiceTestBeforeApproval.purchaseAuthorized,false);
 }
});

test('request pack sends nothing and authorizes nothing',()=>{
 assert.equal(data.externalMessagesSent,0);
 assert.equal(data.paidCallsTriggered,0);
 assert.equal(data.purchaseAuthorized,false);
 assert.ok(data.targets.every(x=>x.externalMessageSent===false));
});
