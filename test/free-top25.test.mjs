import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {FREE_TOP25_NICHES} from '../free-top25-data.js';
import {hasFeature} from '../billing-plans.js';

test('Free Top 25 ships exactly eight niches with 25 documented products each',()=>{
  assert.equal(FREE_TOP25_NICHES.length,8);
  assert.deepEqual(FREE_TOP25_NICHES.map(n=>n.id),['CASA','AUTO','ELECTRONICE','BEAUTY','PET','SPORT','COPII','BIROU']);
  for(const niche of FREE_TOP25_NICHES){
    assert.equal(niche.products.length,25,`${niche.id} must have 25 products`);
    niche.products.forEach((p,index)=>{
      assert.equal(p.rank,index+1);
      assert.equal(p.internalRankClass,'DERIVED');
      assert.match(p.sourceUrl,/^https?:\/\//);
      assert.ok(['A','B','C'].includes(p.sourceTier));
      assert.ok(['VERIFIED','ESTIMATED','DERIVED'].includes(p.evidenceClass));
      assert.ok(p.sourceLabel);
      assert.ok(p.sourcePeriod);
      if(p.metric){
        assert.notEqual(String(p.metric.unit).toLowerCase(),'sales');
        if(p.metric.unit==='searches')assert.match(p.metric.label,/Căutări/i);
      }
    });
  }
});

test('Free Top 25 is free while dynamic Discover remains a paid entitlement',()=>{
  assert.equal(hasFeature('FREE','FREE_TOP25'),true);
  assert.equal(hasFeature('FREE','TOP_PRODUCTS'),false);
  assert.equal(hasFeature('DISCOVER','FREE_TOP25'),true);
  assert.equal(hasFeature('DISCOVER','TOP_PRODUCTS'),true);
});

test('Top 25 UI clearly separates internal rank, source rank and search volume from sales',async()=>{
  const html=await fs.readFile(new URL('../top25.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../top25.js',import.meta.url),'utf8');
  assert.match(html,/ordinea internă.*DERIVED/is);
  assert.match(html,/rank-ul sursei/i);
  assert.match(html,/Search volume nu este prezentat ca vânzări/i);
  assert.match(js,/Rank sursă/);
  assert.match(js,/Statistică publică/);
  assert.match(js,/Vezi sursa/);
  assert.doesNotMatch(`${html}\n${js}`,/vânzări confirmate:\s*\d/i);
});

test('Top 25 pages and dataset are included in the Netlify build',async()=>{
  const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  for(const file of ['top25.html','top25.js','free-top25-data.js'])assert.match(build,new RegExp(file.replace('.','\\.')));
});
