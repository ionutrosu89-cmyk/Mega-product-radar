import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {appendFeedback,feedbackDecisionRows,normalizeFeedbackRows} from '../feedback-store.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('legacy feedback remains readable but is never decision eligible',()=>{
  const rows=normalizeFeedbackRows([{name:'Legacy product',predictedScore:90,actualMargin:10,at:'2026-08-26T10:00:00Z'}]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].identityStatus,'LEGACY_COMPATIBILITY');
  assert.equal(rows[0].decisionEligible,false);
  assert.equal(feedbackDecisionRows(rows).length,0);
});

test('canonical feedback history preserves title changes and separate product ids',()=>{
  let rows=appendFeedback([],{canonicalProductId:A,name:'Old title',predictedScore:80,actualMargin:40,at:'2026-08-26T10:00:00Z'});
  rows=appendFeedback(rows,{canonicalProductId:A,name:'New title',predictedScore:82,actualMargin:42,at:'2026-08-27T10:00:00Z'});
  rows=appendFeedback(rows,{canonicalProductId:B,name:'New title',predictedScore:75,actualMargin:30,at:'2026-08-27T10:00:00Z'});
  assert.equal(rows.length,3);
  assert.equal(feedbackDecisionRows(rows).length,3);
  assert.equal(new Set(rows.map(x=>x.canonicalProductId)).size,2);
});

test('append feedback fails closed without canonical id and never infers from title',()=>{
  const rows=appendFeedback([],{name:'Same title',predictedScore:99,actualMargin:99,at:'2026-08-26T10:00:00Z'});
  assert.equal(rows.length,0);
});

test('executive UI requires canonical ids and Netlify ships identity dependencies',async()=>{
  const html=await fs.readFile(new URL('../executive-ro.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../executive-dashboard.js',import.meta.url),'utf8');
  const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  for(const id of['pCanonicalId','fCanonicalId','portfolioIdentityStatus','feedbackIdentityStatus'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/isCanonicalProductId\(canonicalProductId\)/);
  assert.match(js,/appendFeedback/);
  for(const file of['executive-ro.html','portfolio-store.js','feedback-store.js','domain-contracts-v1.js'])assert.match(build,new RegExp(`'${file.replace('.','\\.')}'`));
});
