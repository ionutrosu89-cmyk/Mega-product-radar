import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('publisher emits only fail-closed validation evidence',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpr-validation-live-'));
  const input=path.join(dir,'in.json'),output=path.join(dir,'out.json');
  fs.writeFileSync(input,JSON.stringify({generatedAt:'2026-08-30T11:00:00Z',target:{marketplace:'AMAZON_US',amazonAsin:'B09K5927B5'},validationQueue:[{externalId:'1601019174460',title:'5-Tier organizer with drawer and pen holders',supplierName:'Dalian Sam',url:'https://www.alibaba.com/product-detail/x_1601019174460.html',sourceUrl:'https://www.alibaba.com/countrysearch/CN/mesh-paper-holder.html',publicPriceCandidate:{currency:'USD',min:7,max:7},moqCandidate:{value:1},validationBlockers:['TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DIMENSIONS_REQUIRED','UNSAFE_UNKNOWN'],missingDistinctiveEvidence:['explicit-two-pen-holders']}]}));
  const run=spawnSync(process.execPath,['scripts/publish-supplier-validation-live-v1.mjs',input,output],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const d=JSON.parse(fs.readFileSync(output,'utf8'));
  assert.equal(d.candidates.length,1);
  assert.equal(d.candidates[0].publicPrice.max,7);
  assert.equal(d.candidates[0].moq.value,1);
  assert.equal(d.candidates[0].canPromoteToMatch,false);
  assert.equal(d.candidates[0].canAuthorizeEconomics,false);
  assert.equal(d.candidates[0].purchaseAuthorized,false);
  assert.equal(d.candidates[0].blockers.includes('UNSAFE_UNKNOWN'),false);
  assert.equal(d.integrity.validationQueueIsMatchEvidence,false);
  assert.equal(d.integrity.unknownEqualsZero,false);
  assert.equal(d.integrity.providerSpendUsd,0);
});
