import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';

const run=()=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,['scripts/finalist-economics-packet-v1.mjs'],{stdio:'ignore'});
 p.on('exit',code=>code===0?resolve():reject(new Error('finalist packet failed')));
});

test('FINALIST economics packet preserves no-contact and landed-cost gates',async()=>{
 await run();
 const d=JSON.parse(await fs.readFile('finalist-economics-live.json','utf8'));
 const x=(d.items||[]).find(x=>x.canonicalKey==='car-sunglasses-magnetic-visor-holder');
 assert.ok(x);
 assert.equal(x.goldenStage,'FINALIST');
 assert.equal(x.supplierContactRequired,false);
 assert.equal(x.salesEstimate.status,'ESTIMATED_HIGH_CONFIDENCE');
 assert.equal(x.salesEstimate.verifiedCompetitorSales,false);
 assert.ok(x.blockers.includes('EXACT_CN_TARIC_CLASSIFICATION_REQUIRED'));
 assert.ok(x.blockers.includes('CONFIRMED_LANDED_COST_REQUIRED'));
 assert.equal(x.testReady,false);
 assert.equal(x.purchaseAuthorized,false);
});
