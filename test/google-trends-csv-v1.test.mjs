import assert from 'node:assert/strict';
import test from 'node:test';
import {parseGoogleTrendsCsv,stageGoogleTrendsObservation} from '../google-trends-csv-v1.js';

const csv='Category: All categories\nWeek,organizator birou: (Romania)\n2026-09-06 - 2026-09-12,28\n2026-09-13 - 2026-09-19,47\n';
const options={nicheId:'BIROU_ORGANIZARE',concept:'organizator birou',sourceUrl:'https://trends.google.com/trends/explore?geo=RO&q=organizator%20birou',retrievedAt:'2026-09-27T10:00:00Z'};

test('official-style CSV becomes a private draft with a relative-index explanation',()=>{
  const parsed=parseGoogleTrendsCsv(csv);
  assert.equal(parsed.latestIndex,47);
  assert.equal(parsed.nonzeroPointCount,2);
  assert.equal(parsed.periodEnd,'2026-09-19');
  const draft=stageGoogleTrendsObservation(csv,options);
  assert.equal(draft.publicStatus,'PENDING_REVIEW');
  assert.equal(draft.claim,'SEARCH_INTEREST');
  assert.match(draft.summary,/nu arată vânzări/i);
  assert.match(draft.summary,/valori >0 în 2\/2/);
});

test('Romanian Google Trends export parses without treating index zero as search volume',()=>{
  const romanian=csv.replace('Category: All categories','Categorie: Toate categoriile').replace('Week,organizator birou: (Romania)','Săptămâna,organizator birou: (România)');
  const draft=stageGoogleTrendsObservation(romanian,options);
  assert.equal(draft.periodEnd,'2026-09-19');
  assert.match(draft.summary,/Zero nu înseamnă zero căutări/);
});

test('a lone nonzero week remains visible as sparse relative-index evidence',()=>{
  const sparse=csv.replace(',28',',0');
  const draft=stageGoogleTrendsObservation(sparse,options);
  assert.equal(draft.nonzeroPointCount,1);
  assert.equal(draft.pointCount,2);
  assert.match(draft.summary,/valori >0 în 1\/2/);
  assert.equal(draft.publicStatus,'PENDING_REVIEW');
});

test('malformed, multi-series and non-RO source input fails closed',()=>{
  assert.throws(()=>parseGoogleTrendsCsv('Week,a,b\n2026-09-06,1,2'),/SINGLE_SERIES/);
  assert.throws(()=>parseGoogleTrendsCsv(csv.replace('47','101')),/ROW_INVALID/);
  assert.throws(()=>stageGoogleTrendsObservation(csv,{...options,sourceUrl:'https://example.com/trends/explore?geo=RO&q=x'}),/SOURCE_OR_NICHE/);
  assert.throws(()=>stageGoogleTrendsObservation(csv,{...options,sourceUrl:'https://trends.google.com/trends/explore?geo=US&q=x'}),/SOURCE_OR_NICHE/);
  assert.throws(()=>stageGoogleTrendsObservation(csv.replace('(Romania)','(United States)'),options),/REGION_NOT_RO/);
  assert.throws(()=>stageGoogleTrendsObservation(csv,{...options,sourceUrl:'https://trends.google.com/trends/explore?geo=RO&q=suport%20documente'}),/QUERY_MISMATCH/);
  assert.throws(()=>stageGoogleTrendsObservation(csv,{...options,concept:'suport documente'}),/QUERY_MISMATCH/);
  assert.throws(()=>stageGoogleTrendsObservation(csv.replaceAll('2026-09','2023-09'),options),/PERIOD_STALE_OR_FUTURE/);
});
