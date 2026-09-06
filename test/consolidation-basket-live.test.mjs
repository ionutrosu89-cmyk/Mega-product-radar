import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';

const run=()=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,['scripts/consolidation-basket-live.mjs'],{stdio:'ignore'});
 p.on('exit',code=>code===0?resolve():reject(new Error('basket failed')));
});

test('live consolidation basket never authorizes filler quantities',async()=>{
 await run();
 const d=JSON.parse(await fs.readFile('consolidation-basket-live.json','utf8'));
 assert.equal(d.supplierOutreachEnabled,false);
 assert.equal(d.purchaseAuthorized,false);
 if(d.selected){
   assert.equal(d.selected.fillerStage,'VALIDATE');
   assert.ok(d.selected.result.totalMeasure>=1);
 }
});
