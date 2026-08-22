import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRefreshedTop25Snapshot,extractExplicitSourceRank,snapshotsEvidenceChanged,uniqueTop25Sources} from '../top25-refresh-core.js';
import {movementDisplay} from '../top25-movement.js';
import {FREE_TOP25_NICHES} from '../free-top25-data.js';

test('explicit published ranks are parsed conservatively',()=>{
  const text='1. Medicube Zero Pore Pad 2.0 2. Eos Shea Better Vanilla Cashmere Body Lotion';
  assert.equal(extractExplicitSourceRank(text,'Medicube Zero Pore Pad 2.0'),1);
  assert.equal(extractExplicitSourceRank(text,'Eos Shea Better Vanilla Cashmere Body Lotion'),2);
  assert.equal(extractExplicitSourceRank(text,'Missing product'),null);
});

test('refresh snapshot only auto-observes rank on rankable public sources',()=>{
  const beauty=FREE_TOP25_NICHES.find(n=>n.id==='BEAUTY');
  const docs=new Map([['BEAUTYMATTER',{ok:true,html:'<h2>3. Medicube Zero Pore Pad 2.0</h2>'}]]);
  const snapshot=buildRefreshedTop25Snapshot(beauty,'2026-08-23',docs);
  const medicube=snapshot.products.find(p=>p.name==='Medicube Zero Pore Pad 2.0');
  assert.equal(medicube.sourceRank,3);
  assert.equal(medicube.rankAutoObserved,true);
});

test('no new revision is required when evidence signature is unchanged',()=>{
  const current={products:[{key:'a',internalRank:1,sourceRank:2}]};
  const previous={products:[{key:'a',internalRank:1,sourceRank:2}]};
  assert.equal(snapshotsEvidenceChanged(current,previous),false);
  assert.equal(snapshotsEvidenceChanged({products:[{key:'a',internalRank:1,sourceRank:1}]},previous),true);
});

test('source rank movement is visible without pretending internal rank moved',()=>{
  const display=movementDisplay({status:'STABLE',delta:0,sourceDelta:2});
  assert.equal(display.label,'SURSA ↑ 2');
  assert.equal(display.tone,'up');
});

test('all Top 25 public sources are deduplicated for one refresh run',()=>{
  const sources=uniqueTop25Sources(FREE_TOP25_NICHES);
  assert.ok(sources.length>=8);
  assert.equal(new Set(sources.map(s=>s.key)).size,sources.length);
  assert.ok(sources.every(s=>/^https:\/\//.test(s.url)));
});

test('scheduled refresh stays free of paid DataForSEO/OpenAI calls',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile('netlify/functions/top25-refresh.mjs','utf8'));
  assert.doesNotMatch(source,/DATAFORSEO|OPENAI_API_KEY|api\.openai\.com/i);
  assert.match(source,/schedule:'15 5 \* \* \*'/);
});
