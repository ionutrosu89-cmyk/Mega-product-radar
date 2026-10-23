import assert from 'node:assert/strict';
import test from 'node:test';
import {FREE_TOP25_LIVE_TAXONOMY,FREE_TOP25_LIVE_TAXONOMY_BY_ID,validateFreeTop25LiveTaxonomy} from '../free-top25-live-taxonomy-v1.js';

test('live acquisition taxonomy covers exactly 25 niches and 625 publishable positions',()=>{
  const result=validateFreeTop25LiveTaxonomy();
  assert.equal(result.ok,true);
  assert.equal(result.nicheCount,25);
  assert.equal(result.targetPositions,625);
  assert.equal(result.candidateTarget,2500);
  assert.equal(FREE_TOP25_LIVE_TAXONOMY_BY_ID.size,25);
  assert.ok(FREE_TOP25_LIVE_TAXONOMY.every(row=>row.queries.en.length>=6&&row.queries.ro.length>=6));
  assert.ok(FREE_TOP25_LIVE_TAXONOMY.every(row=>row.categoryMappingStatus==='HUMAN_REVIEW_REQUIRED'));
});

test('taxonomy validation rejects duplicate queries and incomplete coverage',()=>{
  const broken=FREE_TOP25_LIVE_TAXONOMY.slice(0,24).map((row,index)=>index?row:{...row,queries:{...row.queries,en:['same','same']}});
  const result=validateFreeTop25LiveTaxonomy(broken);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.includes('DUPLICATE_QUERY')));
  assert.ok(result.errors.some(error=>error.startsWith('TAXONOMY_SIZE_')));
});
