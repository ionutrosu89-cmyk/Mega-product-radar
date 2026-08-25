import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildAmazonTargetNicheCoverage} from '../amazon-target-niche-coverage-v1.js';

const catalogue=JSON.parse(fs.readFileSync(new URL('../data/real-products-1000.compact.json',import.meta.url),'utf8'));
const files=['data/live-snapshots/amazon-2026-08-25-batch-000.compact.json','data/live-snapshots/amazon-round1-remaining.compact.json','data/live-snapshots/amazon-round1-missing-retry.compact.json'];
const docs=files.map(sourceFile=>({sourceFile,doc:JSON.parse(fs.readFileSync(new URL('../'+sourceFile,import.meta.url),'utf8'))}));

test('coverage planner scans the full 1K universe and partitions target matches by live status',()=>{
 const x=buildAmazonTargetNicheCoverage(catalogue,docs);
 assert.equal(x.catalogueSize,1000);
 assert.equal(x.liveObservedUniqueAsins,255);
 assert.equal(x.targetNicheCount,4);
 assert.equal(x.totalStrictMatches,x.liveStrictMatches+x.missingLiveStrictMatches);
 assert.equal(x.liveStrictMatches,0);
 for(const [key,s] of Object.entries(x.byNiche)){
   assert.equal(s.catalogueMatches,s.liveMatches+s.missingLiveMatches,key);
   assert.equal(s.liveMatches,0,key);
 }
 console.log('AMAZON_TARGET_NICHE_COVERAGE='+JSON.stringify({totalStrictMatches:x.totalStrictMatches,missingLiveStrictMatches:x.missingLiveStrictMatches,byNiche:x.byNiche,matches:x.matches}));
});

test('missing target matches are prioritization hints only',()=>{
 const x=buildAmazonTargetNicheCoverage(catalogue,docs);
 for(const m of x.matches.filter(x=>!x.hasFirstLiveObservation)) assert.equal(m.liveObservationPriority,'PRIORITIZE_FIRST_LIVE');
 assert.equal(x.verifiedSales,false);
 assert.equal(x.rankInferred,false);
 assert.equal(x.paidCallsTriggered,0);
 assert.equal(x.providerSpend,0);
 assert.equal(x.purchaseAuthorized,false);
});
