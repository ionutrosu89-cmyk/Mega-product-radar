import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';

const run=()=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,['scripts/supplier-page-evidence-collector.mjs'],{stdio:'ignore'});
 p.on('exit',code=>code===0?resolve():reject(new Error('collector failed')));
});

test('supplier page collector emits no-contact page-backed registry',async()=>{
 await run();
 const out=JSON.parse(await fs.readFile('supplier-page-evidence-live.json','utf8'));
 assert.equal(out.supplierOutreachEnabled,false);
 assert.equal(out.purchaseAuthorized,false);
 const p=out.products.find(x=>x.canonicalKey==='car-sunglasses-magnetic-visor-holder');
 assert.ok(p);
 assert.equal(p.status,'PAGE_BACKED_SCREENING_READY');
 assert.equal(p.bestScreeningCandidate.supplierContactRequired,false);
 assert.equal(p.bestScreeningCandidate.evidenceClass,'DIRECT_OBSERVED');
 assert.ok(p.bestScreeningCandidate.conservativeScreeningUnitPriceUsd>0);
 assert.equal(p.bestScreeningCandidate.supplierName,'Ningbo Desheng Imp. & Exp. Co., Ltd.');
 assert.equal(p.bestScreeningCandidate.directProductPage,true);
 assert.ok(p.candidates.filter(x=>/wholesale/i.test(x.sourceUrl||'')).every(x=>x.pageBackedScreeningReady===false));
});
