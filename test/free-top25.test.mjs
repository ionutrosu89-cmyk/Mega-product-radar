import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {FREE_TOP25_NICHES} from '../free-top25-data.js';
import {hardenTop25Evidence,TOP25_EVIDENCE_REVIEWED_AT} from '../top25-evidence.js';
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
      assert.ok(p.sourceLabel);
      assert.ok(p.sourcePeriod);
      if(p.metric){
        assert.notEqual(String(p.metric.unit).toLowerCase(),'sales');
        if(p.metric.unit==='searches')assert.match(p.metric.label,/Căutări/i);
      }
    });
  }
});

test('evidence hardening suppresses unobserved source ranks and separates evidence confidence',()=>{
  assert.match(TOP25_EVIDENCE_REVIEWED_AT,/^\d{4}-\d{2}-\d{2}$/);
  for(const niche of FREE_TOP25_NICHES){
    for(const raw of niche.products){
      const p=hardenTop25Evidence(raw);
      assert.ok(['EXACT_RANK','EXACT_PRODUCT','SEARCH_VOLUME','TREND_SIGNAL','EDITORIAL_SIGNAL','CATEGORY_EVIDENCE'].includes(p.evidenceType));
      assert.ok(['HIGH','MEDIUM'].includes(p.evidenceConfidence));
      assert.ok(['VERIFIED','DERIVED'].includes(p.evidenceClass));
      assert.equal(p.evidenceReviewedAt,TOP25_EVIDENCE_REVIEWED_AT);
      if(p.sourceRank!==null){
        assert.equal(p.sourceRankObserved,true);
        assert.equal(p.sourceKey,'BEAUTYMATTER');
        assert.equal(p.evidenceType,'EXACT_RANK');
      }else{
        assert.equal(p.sourceRankObserved,false);
      }
      if(p.evidenceType==='SEARCH_VOLUME')assert.equal(p.metric?.unit,'searches');
    }
  }
});

test('Free Top 25 is free while dynamic Discover remains a paid entitlement',()=>{
  assert.equal(hasFeature('FREE','FREE_TOP25'),true);
  assert.equal(hasFeature('FREE','TOP_PRODUCTS'),false);
  assert.equal(hasFeature('DISCOVER','FREE_TOP25'),true);
  assert.equal(hasFeature('DISCOVER','TOP_PRODUCTS'),true);
});

test('Top 25 UI clearly separates internal rank, observed source rank and evidence confidence',async()=>{
  const html=await fs.readFile(new URL('../top25.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../top25.js',import.meta.url),'utf8');
  assert.match(html,/ordinea internă.*DERIVED/is);
  assert.match(html,/Rank sursă.*numai.*observată explicit/is);
  assert.match(html,/Încredere în dovadă.*nu șansa comercială/is);
  assert.match(html,/Search volume nu este prezentat ca vânzări/i);
  assert.match(js,/Rank sursă observat/);
  assert.match(js,/Încredere în dovadă/);
  assert.match(js,/Tip dovadă/);
  assert.match(js,/Revizie dovadă/);
  assert.match(js,/Vezi sursa/);
  assert.doesNotMatch(`${html}\n${js}`,/vânzări confirmate:\s*\d/i);
});

test('Top 25 pages, evidence policy and dataset are included in the Netlify build',async()=>{
  const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  for(const file of ['top25.html','top25.js','top25-evidence.js','free-top25-data.js'])assert.match(build,new RegExp(file.replace('.','\\.')));
});
