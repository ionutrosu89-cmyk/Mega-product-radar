import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {classifyDataDocument,inventoryDataDirectory} from '../scripts/p2-data-inventory.mjs';

test('known public ranking schema maps to supported adapter',()=>{
  const x=classifyDataDocument({schemaVersion:'MPR_AMAZON_PUBLIC_RANKING_PERSISTED_V1'});
  assert.equal(x.classification,'SUPPORTED_RAW_ADAPTER');assert.equal(x.adapter,'AMAZON_PUBLIC_RANKING');
});

test('derived leader artifacts never become raw observations',()=>{
  const x=classifyDataDocument({schemaVersion:'MPR_AMAZON_ROUND2_PRELIMINARY_LEADERS_V1',leaders:[{reviewDelta:14}]});
  assert.equal(x.classification,'DERIVED_OR_CONTROL_ARTIFACT');assert.equal(x.adapter,null);
});

test('absolute snapshot candidates are detected without upgrading evidence',()=>{
  const x=classifyDataDocument({schemaVersion:'CUSTOM_V1',rows:[{asin:'A1',price:10,reviewCount:5}]});
  assert.equal(x.classification,'ABSOLUTE_SNAPSHOT_CANDIDATE');assert.equal(x.adapter,'ABSOLUTE_PRODUCT_SNAPSHOT');
});

test('inventory reports parse errors and performs no paid calls',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mpr-p2-inventory-'));
  fs.writeFileSync(path.join(dir,'ranking.json'),JSON.stringify({schemaVersion:'MPR_AMAZON_PUBLIC_RANKING_PERSISTED_V1'}));
  fs.writeFileSync(path.join(dir,'broken.json'),'{');
  const r=inventoryDataDirectory(dir);
  assert.equal(r.totalJsonFiles,2);assert.equal(r.records.length,1);assert.equal(r.parseErrors.length,1);assert.equal(r.paidCallsTriggered,0);assert.equal(r.providerSpendEur,0);assert.equal(r.purchaseAuthorized,false);
});
