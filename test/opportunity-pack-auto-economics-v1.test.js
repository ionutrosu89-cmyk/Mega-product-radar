import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function run(pack){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpr-auto-econ-'));
  const packPath=path.join(dir,'pack.json'),outPath=path.join(dir,'out.json');
  fs.writeFileSync(packPath,JSON.stringify(pack));
  const r=spawnSync(process.execPath,['scripts/run-opportunity-pack-economics-v1.mjs',packPath,'data/v2-public-economics-evidence-2026-08-29.json','data/v2-conservative-screening-defaults-v1.json',outPath,'12345'],{encoding:'utf8'});
  return {r,out:r.status===0?JSON.parse(fs.readFileSync(outPath,'utf8')):null};
}

test('blocked opportunity pack never runs economics',()=>{
  const {r,out}=run({status:'BLOCKED',economicsAllowed:false,target:{asin:'B09K5927B5'},source:{rematchWorkflowRunId:999},blockers:['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED']});
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'BLOCKED_UPSTREAM_OPPORTUNITY_PACK');
  assert.equal(out.economics,null);
  assert.equal(out.decision,'VALIDATE');
  assert.equal(out.rankingScenario,'CONSERVATIVE');
  assert.equal(out.purchaseAuthorized,false);
});

test('economics-ready opportunity pack runs generic conservative screen',()=>{
  const pack={status:'ECONOMICS_READY',economicsAllowed:true,target:{asin:'B09K5927B5'},source:{rematchWorkflowRunId:999},supplier:{unitPriceUsd:6,externalId:'x'},romaniaPrice:{grossRon:200},romaniaPriceEvidence:{source:'https://example.ro/product'},directSupplierEvidence:{assembledDimensionsCm:{lengthCm:35,widthCm:30.5,heightCm:27.9},netWeightGrams:1800},match:{confidence:85,hardMismatches:[]},inputEvidence:{supplierPriceEvidenceClass:'SUPPLIER_DIRECT_REPLY_EVIDENCE'}};
  const {r,out}=run(pack);
  assert.equal(r.status,0,r.stderr);
  assert.equal(out.status,'SCREENED');
  assert.equal(out.economics.status,'SCREENED');
  assert.equal(out.economics.rankingScenario,'CONSERVATIVE');
  assert.ok(['SCREENING_OPPORTUNITY','REJECT_CONSERVATIVE_ECONOMICS'].includes(out.opportunityGate.decision));
  assert.equal(out.truthPolicy.screeningOpportunityIsFinalist,false);
  assert.equal(out.purchaseAuthorized,false);
});
