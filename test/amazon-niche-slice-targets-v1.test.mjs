import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Amazon US research slices cover every reviewed niche without granting publication approval',async()=>{
  const [review,targets]=await Promise.all([
    fs.readFile(new URL('../data/top25-niche-review-v1.json',import.meta.url),'utf8').then(JSON.parse),
    fs.readFile(new URL('../data/amazon-niche-slice-targets-v1.json',import.meta.url),'utf8').then(JSON.parse)
  ]);
  assert.equal(targets.market,'AMAZON_US');
  assert.equal(targets.status,'PROPOSED_CATEGORY_SLICES_NOT_NICHE_COVERAGE');
  assert.equal(targets.targets.length,25);
  assert.deepEqual(new Set(targets.targets.map(row=>row.nicheId)),new Set(review.niches.map(row=>row.id)));
  for(const row of targets.targets){
    assert.match(row.url,/^https:\/\/www\.amazon\.com\/Best-Sellers-[^\s]+\/zgbs\/[^/]+\/\d+$/);
    assert.ok(row.category);
  }
});
