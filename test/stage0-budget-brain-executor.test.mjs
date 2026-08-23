import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {applyPaidAllowlist,normalizeProductKey} from '../scripts/stage0-budget-brain.mjs';

test('Stage 0 allowlist is fail-closed and blocks products not explicitly authorized',()=>{
  const data={products:[
    {name:'Under desk headphone hanger clamp',goldenPipeline:{paidDataEligible:true,rank:1}},
    {name:'Unrelated product',goldenPipeline:{paidDataEligible:true,rank:2}}
  ]};
  const targets=[{canonical_key:'under-desk-headphone-hanger-clamp',title:'Under desk headphone hanger clamp',status:'VALIDATE',estimated_cost_eur:.05,information_value:160}];
  const out=applyPaidAllowlist(data,targets);
  assert.equal(out.stats.eligible,1);
  assert.equal(out.data.products[0].goldenPipeline.paidDataEligible,true);
  assert.equal(out.data.products[0].goldenPipeline.paidDataPriority,1);
  assert.equal(out.data.products[1].goldenPipeline.paidDataEligible,false);
  assert.equal(out.data.products[1].goldenPipeline.paidDataPriority,999999);
});

test('empty or invalid Budget Brain response authorizes zero paid products',()=>{
  const data={products:[{name:'Any product',goldenPipeline:{paidDataEligible:true}}]};
  const out=applyPaidAllowlist(data,[]);
  assert.equal(out.stats.eligible,0);
  assert.equal(out.data.products[0].goldenPipeline.paidDataEligible,false);
});

test('only PROMISING/VALIDATE targets can authorize spend',()=>{
  const data={products:[{name:'Candidate A'},{name:'Candidate B'}]};
  const out=applyPaidAllowlist(data,[
    {canonical_key:'candidate-a',title:'Candidate A',status:'DISCOVERED'},
    {canonical_key:'candidate-b',title:'Candidate B',status:'PROMISING'}
  ]);
  assert.equal(out.stats.eligible,1);
  assert.equal(out.data.products[0].goldenPipeline.paidDataEligible,false);
  assert.equal(out.data.products[1].goldenPipeline.paidDataEligible,true);
});

test('normalization matches canonical product keys deterministically',()=>{
  assert.equal(normalizeProductKey('Cârlige pentru tetieră auto'),'carlige-pentru-tetiera-auto');
  assert.equal(normalizeProductKey('  Desk drawer organizer modular trays  '),'desk-drawer-organizer-modular-trays');
});

test('radar workflow syncs Budget Brain before paid calls and scopes deep provider wrapper',async()=>{
  const workflow=await fs.readFile('.github/workflows/radar-scan.yml','utf8');
  const syncPos=workflow.indexOf('stage0-budget-brain-sync.mjs');
  const keywordPos=workflow.indexOf('dataforseo-keywords.mjs');
  const providerPos=workflow.indexOf('provider-intelligence-stage0.mjs');
  assert.ok(syncPos>=0,'Budget Brain sync step missing');
  assert.ok(keywordPos>syncPos,'keyword enrichment must run after Budget Brain sync');
  assert.ok(providerPos>syncPos,'deep provider enrichment must run after Budget Brain sync');
  assert.equal(workflow.includes('run: node scripts/provider-intelligence-v26.mjs'),false,'workflow must not call the unscoped paid provider directly');
});
