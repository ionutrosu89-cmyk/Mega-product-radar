import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import taxonomy from '../category-universe-v2.json' with {type:'json'};
import {approvedMappingsForSeed,buildCategoryMappingReviewQueue} from '../category-mapping-review-queue.js';
import {buildPublicSeedRunManifest} from '../public-seed-run-manifest.js';

const seed=JSON.parse(fs.readFileSync(new URL('../category-mapping-evidence-seed-v1.json',import.meta.url),'utf8'));

test('first evidence seed approves only cable management',()=>{
  const out=approvedMappingsForSeed({taxonomy,mappings:seed.mappings});
  assert.equal(out.approvedCount,1);
  assert.equal(out.approved[0].mprCategory,'office:cable-management');
  assert.equal(out.approved[0].ebay.categoryId,'67858');
  assert.equal(out.approved[0].alibaba.categorySlug,'cable-management');
});

test('narrow laptop stands evidence remains needs review',()=>{
  const queue=buildCategoryMappingReviewQueue({taxonomy,mappings:seed.mappings});
  const row=queue.rows.find(x=>x.mprCategory==='office:laptop-accessories');
  assert.equal(row.status,'NEEDS_REVIEW');
  assert.equal(row.executable,false);
});

test('verified cable management mapping creates only Alibaba and eBay tasks',()=>{
  const approved=approvedMappingsForSeed({taxonomy,mappings:seed.mappings}).approved;
  const manifest=buildPublicSeedRunManifest({categoryMappings:approved,maxTasks:20});
  assert.equal(manifest.taskCount,2);
  assert.equal(manifest.stats.byPlatform.ALIBABA,1);
  assert.equal(manifest.stats.byPlatform.EBAY,1);
  assert.equal(manifest.stats.byPlatform.AMAZON,undefined);
  assert.equal(manifest.approvedSpendEur,0);
  assert.equal(manifest.externalExecutionTriggered,false);
});
