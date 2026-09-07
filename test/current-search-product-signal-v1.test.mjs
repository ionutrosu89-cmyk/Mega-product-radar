import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyCurrentSearchProductSignal,normalizeCurrentSearchSignal} from '../current-search-product-signal-v1.js';

test('product-oriented query maps to an MPR niche',()=>{
  const result=classifyCurrentSearchProductSignal('packing cube travel organizer');
  assert.equal(result.productRelevant,true);
  assert.equal(result.niches.some(row=>row.nicheId==='CALATORII'),true);
});

test('news and match contexts are not treated as product demand',()=>{
  assert.equal(classifyCurrentSearchProductSignal('arsenal vs chelsea live score').productRelevant,false);
  assert.equal(classifyCurrentSearchProductSignal('alegeri presedinte stiri').productRelevant,false);
});

test('normalized Google trend signal remains search interest, never sales',()=>{
  const row=normalizeCurrentSearchSignal({queryText:'makeup organizer',windowDays:7,observedAt:'2026-09-07T12:00:00Z',signalType:'TRENDING_NOW',market:'RO',sourceKey:'GOOGLE_TRENDS_TRENDING_NOW',sourceUrl:'https://trends.google.com/trending?geo=RO',searchVolumeLowerBound:5000,growthPercent:800});
  assert.ok(row);
  assert.equal(row.salesEvidenceClass,'SEARCH_INTEREST_NOT_SALES');
  assert.equal(row.evidenceClass,'DIRECT');
  assert.equal(row.nicheMatches.some(match=>match.nicheId==='BEAUTY'),true);
});
