import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const run=cwd=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,[path.resolve('scripts/finalist-economics-packet-v1.mjs')],{cwd,stdio:'ignore'});
 p.on('error',reject);
 p.on('exit',code=>code===0?resolve():reject(new Error('finalist packet failed')));
});

test('FINALIST screening fixture preserves no-contact and landed-cost gates without requiring a real finalist',async t=>{
 const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'mpr-finalist-'));
 t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
 for(const file of ['supplier-page-evidence-live.json','public-sales-estimation-live.json','commercial-observations.json','market-intelligence-live.json','consolidation-basket-live.json'])await fs.copyFile(file,path.join(cwd,file));
 for(const dir of ['freight-benchmarks','customs-classification','import-processing','romania-pricing'])await fs.cp(path.join('data',dir),path.join(cwd,'data',dir),{recursive:true});
 await fs.copyFile('test/fixtures/consolidation-screening.json',path.join(cwd,'consolidation-basket-live.json'));
 // Synthetic upstream label tests the downstream refusal to authorize a purchase.
 await fs.writeFile(path.join(cwd,'golden-pipeline-live.json'),JSON.stringify({items:[{name:'Car sunglasses magnetic visor holder',stage:'FINALIST'}]}));
 await run(cwd);
 const d=JSON.parse(await fs.readFile(path.join(cwd,'finalist-economics-live.json'),'utf8'));
 const x=(d.items||[]).find(x=>x.canonicalKey==='car-sunglasses-magnetic-visor-holder');
 assert.ok(x);
 assert.equal(x.goldenStage,'FINALIST');
 assert.equal(x.supplierContactRequired,false);
 assert.equal(x.salesEstimate.status,'ESTIMATED_HIGH_CONFIDENCE');
 assert.equal(x.salesEstimate.verifiedCompetitorSales,false);
 assert.ok(x.blockers.includes('EXACT_CN_TARIC_CLASSIFICATION_REQUIRED'));
 assert.ok(x.blockers.includes('CONFIRMED_LANDED_COST_REQUIRED'));
 assert.ok(x.screeningVerdict);
 assert.equal(x.screeningVerdict.testReady,false);
 assert.ok(x.residualLocalCostCeilingsByVatTreatment?.NON_RECOVERABLE);
 assert.ok(x.residualLocalCostCeilingsByVatTreatment?.RECOVERABLE);
 assert.ok(x.customsRepresentationHeadroom);
 assert.equal(x.customsRepresentationHeadroom.directSeaLclConclusion,'UNKNOWN_NO_DIRECT_LCL_BENCHMARK');
 assert.equal(x.testReady,false);
 assert.equal(x.purchaseAuthorized,false);
 await fs.writeFile(path.join(cwd,'golden-pipeline-live.json'),JSON.stringify({items:[]}));
 await run(cwd);
 assert.equal(JSON.parse(await fs.readFile(path.join(cwd,'finalist-economics-live.json'),'utf8')).items.length,0);
});
