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

test('blocked shortlist persists blockers and no candidate',()=>{
  const {r,out}=publish({status:'BLOCKED_UPSTREAM_RANKING',rankingScenario:'CONSERVATIVE',generatedAt:'2026-08-30T10:00:00Z',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'],candidates:[]});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'BLOCKED_UPSTREAM_RANKING');
  assert.deepEqual(out.candidates,[]);
  assert.deepEqual(out.blockers,['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']);
  assert.equal(out.integrity.privateSupplierEvidenceIncluded,false);
  assert.equal(out.integrity.purchaseAuthorized,false);
});

test('shortlisted handoff exposes only dashboard-safe fields',()=>{
  const {r,out}=publish({status:'SHORTLISTED',rankingScenario:'CONSERVATIVE',generatedAt:'2026-08-30T10:00:00Z',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:[],candidates:[{rank:1,target:{marketplace:'AMAZON_US',asin:'B09K5927B5'},decision:'SHORTLIST_CANDIDATE',metrics:{roi:1.2,netMargin:0.31,netProfitRon:52.4},thresholds:{roi:0.8,netMargin:0.25},evidence:{economicsStatus:'SCREENED',supplierName:'PRIVATE'},shortlistPromoted:true,finalistPromoted:false,purchaseAuthorized:false,supplierName:'PRIVATE',supplierUrl:'https://private.example'}]});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].target.asin,'B09K5927B5');
  assert.equal(out.candidates[0].supplierName,undefined);
  assert.equal(out.candidates[0].supplierUrl,undefined);
  assert.equal(out.candidates[0].evidence.supplierName,undefined);
  assert.equal(out.candidates[0].finalistPromoted,false);
  assert.equal(out.candidates[0].purchaseAuthorized,false);
});

test('malformed promotion fails closed',()=>{
  const {r}=publish({status:'SHORTLISTED',rankingScenario:'CONSERVATIVE',source:sourceIds,purchaseAuthorized:false,truthPolicy,blockers:[],candidates:[{rank:1,target:{marketplace:'AMAZON_US',asin:'X'},metrics:{roi:1,netMargin:.3,netProfitRon:10},shortlistPromoted:true,finalistPromoted:true,purchaseAuthorized:false}]});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/SHORTLIST_AUTHORITY_BREACH/);
});
