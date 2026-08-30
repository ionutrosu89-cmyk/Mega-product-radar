import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function run(ranking){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpr-shortlist-'));
  const input=path.join(dir,'ranking.json'),out=path.join(dir,'shortlist.json');
  fs.writeFileSync(input,JSON.stringify(ranking));
  const r=spawnSync(process.execPath,['scripts/run-opportunity-shortlist-v1.mjs',input,out,'35791'],{encoding:'utf8'});
  return {r,out:r.status===0?JSON.parse(fs.readFileSync(out,'utf8')):null};
}

const truthPolicy={unknownEqualsZero:false,purchaseAuthorized:false,providerSpendUsd:0,rankingDoesNotAuthorizeShortlist:true,rankingCandidateIsNotFinalist:true};

test('blocked ranking never creates shortlist candidates',()=>{
  const {r,out}=run({status:'BLOCKED_UPSTREAM_ECONOMICS',source:{economicsWorkflowRunId:24680,opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99},blockers:['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'],truthPolicy});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'BLOCKED_UPSTREAM_RANKING');
  assert.equal(out.decision,'VALIDATE');
  assert.deepEqual(out.candidates,[]);
  assert.deepEqual(out.blockers,['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.truthPolicy.shortlistDoesNotAuthorizeFinalist,true);
  assert.equal(out.truthPolicy.unknownEqualsZero,false);
});

test('shortlist rejects malformed ranked candidate instead of inferring eligibility',()=>{
  const ranking={status:'RANKED',rankingScenario:'CONSERVATIVE',source:{economicsWorkflowRunId:24680,opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99},truthPolicy,candidates:[{rank:1,decision:'RANKING_CANDIDATE',shortlistEligible:false,shortlistPromoted:false,metrics:{roi:1.2,netMargin:0.31,netProfitRon:52.4}}]};
  const {r}=run(ranking);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/INVALID_RANKING_CANDIDATE/);
});

test('valid ranked candidate becomes shortlist-only candidate with no finalist or purchase authority',()=>{
  const ranking={status:'RANKED',rankingScenario:'CONSERVATIVE',source:{economicsWorkflowRunId:24680,opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99},truthPolicy,candidates:[{rank:1,target:{marketplace:'AMAZON_US',asin:'B09K5927B5'},decision:'RANKING_CANDIDATE',shortlistEligible:true,shortlistPromoted:false,metrics:{roi:1.2,netMargin:0.31,netProfitRon:52.4},thresholds:{roi:0.8,netMargin:0.25},evidence:{economicsStatus:'SCREENED',rankingScenario:'CONSERVATIVE'}}]};
  const {r,out}=run(ranking);
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'SHORTLISTED');
  assert.equal(out.decision,'SHORTLIST_CANDIDATE');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].shortlistPromoted,true);
  assert.equal(out.candidates[0].finalistPromoted,false);
  assert.equal(out.candidates[0].purchaseAuthorized,false);
  assert.equal(out.truthPolicy.shortlistDoesNotAuthorizeFinalist,true);
  assert.equal(out.truthPolicy.shortlistCandidateIsNotPurchaseAuthorization,true);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.source.rankingWorkflowRunId,35791);
  assert.equal(out.source.economicsWorkflowRunId,24680);
});
