import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanAmazonRomaniaCandidates} from '../amazon-romania-candidate-scanner-v1.js';

const files=[
 'data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',
 'data/live-snapshots/amazon-round1-remaining.compact.json',
 'data/live-snapshots/amazon-round1-missing-retry.compact.json'
];
const docs=files.map(sourceFile=>({sourceFile,doc:JSON.parse(fs.readFileSync(new URL('../'+sourceFile,import.meta.url),'utf8'))}));
const catalogue=JSON.parse(fs.readFileSync(new URL('../data/real-products-1000.compact.json',import.meta.url),'utf8'));

test('scanner evaluates exactly the 255 unique live Amazon ASINs and reports strict canonical matches',()=>{
 const x=scanAmazonRomaniaCandidates(docs,catalogue);
 assert.equal(x.scannedUniqueLiveAsins,255);
 assert.equal(new Set(x.matches.map(m=>m.asin+'|'+m.canonicalNicheKey)).size,x.matches.length);
 for(const m of x.matches){
   assert.equal(m.canonicalMatch,true);
   assert.ok(m.asin);
   assert.ok(m.title);
   assert.ok(files.includes(m.sourceSnapshotFile));
   assert.ok(['LIVE_PRODUCT_PAGE','BOOTSTRAP_IDENTITY_CATALOGUE'].includes(m.titleSource));
 }
 console.log('AMAZON_ROMANIA_CANDIDATE_SCAN='+JSON.stringify({scanned:x.scannedUniqueLiveAsins,matchCount:x.matchCount,matches:x.matches}));
});

test('scanner cannot infer rank sales spend or purchase authority',()=>{
 const x=scanAmazonRomaniaCandidates(docs,catalogue);
 assert.equal(x.verifiedSales,false);
 assert.equal(x.rankInferred,false);
 assert.equal(x.paidCallsTriggered,0);
 assert.equal(x.providerSpend,0);
 assert.equal(x.purchaseAuthorized,false);
});

test('strict rules reject related but noncanonical wording',()=>{
 const synthetic={fields:['asin','title','observedAt'],products:[
   ['A1','Laptop leather desk pad','2026-08-25T00:00:00Z'],
   ['A2','Cat6 cable 6 ft','2026-08-25T00:00:00Z'],
   ['A3','Seat back mesh car organizer','2026-08-25T00:00:00Z'],
   ['A4','Travel laundry bag','2026-08-25T00:00:00Z']
 ]};
 const syntheticCatalogue={fields:['asin','title'],products:[['A1','Laptop leather desk pad'],['A2','Cat6 cable 6 ft'],['A3','Seat back mesh car organizer'],['A4','Travel laundry bag']]};
 const x=scanAmazonRomaniaCandidates([{sourceFile:'synthetic',doc:synthetic}],syntheticCatalogue);
 assert.equal(x.matchCount,0);
});
