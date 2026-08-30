import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function run(economics){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpr-ranking-'));
  const input=path.join(dir,'economics.json'),out=path.join(dir,'ranking.json');
  fs.writeFileSync(input,JSON.stringify(economics));
  const r=spawnSync(process.execPath,['scripts/run-opportunity-ranking-v1.mjs',input,out,'24680'],{encoding:'utf8'});
  return {r,out:r.status===0?JSON.parse(fs.readFileSync(out,'utf8')):null};
}

const truthPolicy={unknownEqualsZero:false,purchaseAuthorized:false,providerSpendUsd:0};

test('blocked economics never creates ranking candidates',()=>{
  const {r,out}=run({status:'BLOCKED_UPSTREAM_OPPORTUNITY_PACK',source:{opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99},upstreamBlockers:['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'],truthPolicy});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'BLOCKED_UPSTREAM_ECONOMICS');
  assert.equal(out.decision,'VALIDATE');
  assert.deepEqual(out.candidates,[]);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.truthPolicy.rankingDoesNotAuthorizeShortlist,true);
});

test('conservative reject never becomes a ranking candidate',()=>{
  const {r,out}=run({status:'SCREENED',rankingScenario:'CONSERVATIVE',source:{opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99},opportunityGate:{qualifies:false,decision:'REJECT_CONSERVATIVE_ECONOMICS'},truthPolicy});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'REJECTED_CONSERVATIVE_ECONOMICS');
  assert.equal(out.decision,'REJECT');
  assert.deepEqual(out.candidates,[]);
});

test('qualified conservative economics creates one non-finalist ranking candidate',()=>{
  const economics={status:'SCREENED',rankingScenario:'CONSERVATIVE',target:{marketplace:'AMAZON_US',asin:'B09K5927B5'},source:{opportunityPackWorkflowRunId:123,rematchWorkflowRunId:99},truthPolicy,opportunityGate:{qualifies:true,decision:'SCREENING_OPPORTUNITY',thresholds:{roi:0.8,netMargin:0.25}},economics:{scenarios:{conservative:{roi:1.2,netMargin:0.31,netProfitRon:52.4}}}};
  const {r,out}=run(economics);
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'RANKED');
  assert.equal(out.decision,'RANKING_CANDIDATE');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].rank,1);
  assert.equal(out.candidates[0].shortlistEligible,true);
  assert.equal(out.candidates[0].shortlistPromoted,false);
  assert.equal(out.truthPolicy.rankingCandidateIsNotFinalist,true);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.source.economicsWorkflowRunId,24680);
});
