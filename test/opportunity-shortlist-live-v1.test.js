import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function publish(source){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpr-shortlist-live-'));
  const input=path.join(dir,'shortlist.json'),out=path.join(dir,'live.json');
  fs.writeFileSync(input,JSON.stringify(source));
  const r=spawnSync(process.execPath,['scripts/publish-opportunity-shortlist-live-v1.mjs',input,out],{encoding:'utf8'});
  return {r,out:r.status===0?JSON.parse(fs.readFileSync(out,'utf8')):null};
}
const truthPolicy={unknownEqualsZero:false,shortlistDoesNotAuthorizeFinalist:true,shortlistCandidateIsNotPurchaseAuthorization:true};
const sourceIds={rankingWorkflowRunId:35791,economicsWorkflowRunId:24680,opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99};

test('blocked shortlist persists blockers and no paid candidate data',()=>{
  const {r,out}=publish({status:'BLOCKED_UPSTREAM_RANKING',rankingScenario:'CONSERVATIVE',generatedAt:'2026-08-30T10:00:00Z',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'],candidates:[]});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'BLOCKED_UPSTREAM_RANKING');
  assert.equal(out.summary.candidateCount,0);
  assert.deepEqual(out.blockers,['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']);
  assert.equal(out.candidates,undefined);
  assert.equal(out.integrity.paidOpportunityDataIncluded,false);
  assert.equal(out.integrity.privateSupplierEvidenceIncluded,false);
  assert.equal(out.integrity.purchaseAuthorized,false);
});

test('shortlisted public handoff exposes only count and pipeline state',()=>{
  const {r,out}=publish({status:'SHORTLISTED',rankingScenario:'CONSERVATIVE',generatedAt:'2026-08-30T10:00:00Z',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:[],candidates:[{rank:1,target:{marketplace:'AMAZON_US',asin:'B09K5927B5'},decision:'SHORTLIST_CANDIDATE',metrics:{roi:1.2,netMargin:0.31,netProfitRon:52.4},thresholds:{roi:0.8,netMargin:0.25},evidence:{economicsStatus:'SCREENED',supplierName:'PRIVATE'},shortlistPromoted:true,finalistPromoted:false,purchaseAuthorized:false,supplierName:'PRIVATE',supplierUrl:'https://private.example'}]});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.summary.candidateCount,1);
  assert.equal(out.candidates,undefined);
  assert.equal(JSON.stringify(out).includes('B09K5927B5'),false);
  assert.equal(JSON.stringify(out).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(out).includes('1.2'),false);
  assert.equal(out.integrity.paidOpportunityDataIncluded,false);
});

test('unknown conservative metrics are never coerced to zero',()=>{
  const {r}=publish({status:'SHORTLISTED',rankingScenario:'CONSERVATIVE',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:[],candidates:[{rank:1,target:{marketplace:'AMAZON_US',asin:'X'},metrics:{roi:null,netMargin:.3,netProfitRon:10},shortlistPromoted:true,finalistPromoted:false,purchaseAuthorized:false}]});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/CONSERVATIVE_METRICS_REQUIRED/);
});

test('malformed promotion fails closed',()=>{
  const {r}=publish({status:'SHORTLISTED',rankingScenario:'CONSERVATIVE',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:[],candidates:[{rank:1,target:{marketplace:'AMAZON_US',asin:'X'},metrics:{roi:1,netMargin:.3,netProfitRon:10},shortlistPromoted:true,finalistPromoted:true,purchaseAuthorized:false}]});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/SHORTLIST_AUTHORITY_BREACH/);
});
