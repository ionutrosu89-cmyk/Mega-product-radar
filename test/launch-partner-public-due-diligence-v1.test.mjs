import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data=JSON.parse(fs.readFileSync(new URL('../data/launch-partner-public-due-diligence-v1.json',import.meta.url),'utf8'));

test('public due diligence covers exactly the five shortlisted Launch candidates',()=>{
 assert.equal(data.candidates.length,5);
 assert.deepEqual(data.candidates.map(x=>x.priority),[1,2,3,4,5]);
 assert.equal(new Set(data.candidates.map(x=>x.partnerKey)).size,5);
});

test('public evidence never becomes MPR verified or tested',()=>{
 for(const x of data.candidates){
  assert.equal(x.reviewStatus,'PUBLIC_CANDIDATE');
  assert.equal(x.mprVerified,false);
  assert.equal(x.testedByMpr,false);
 }
 assert.equal(data.summary.mprVerifiedCount,0);
 assert.equal(data.summary.testedByMprCount,0);
});

test('only independently observed legal identity is labeled independently verified',()=>{
 const independent=data.candidates.filter(x=>x.legalIdentity.independentlyVerified===true);
 assert.equal(independent.length,1);
 assert.equal(independent[0].partnerKey,'CONNECTEXIMP');
 assert.equal(independent[0].legalIdentity.verificationScope,'LEGAL_IDENTITY_ONLY');
});

test('next action requires documents and sends nothing automatically',()=>{
 assert.equal(data.nextManualAction.type,'REQUEST_DOCUMENTS_AND_WRITTEN_TERMS');
 assert.equal(data.nextManualAction.externalMessagesSent,0);
 assert.equal(data.summary.paidCallsTriggered,0);
 assert.equal(data.summary.purchaseAuthorized,false);
});
