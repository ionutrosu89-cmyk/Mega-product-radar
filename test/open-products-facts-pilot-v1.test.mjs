import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {createOpenProductsFactsPilot,evaluateOpenProductsFactsRecord} from '../open-products-facts-pilot-v1.js';

const now=new Date('2026-09-27T12:00:00Z');
const record=(changes={})=>({code:'1234567890123',product_name:'Desk cable organizer tray',brands:'Small maker',categories_tags:['en:office-supplies'],last_modified_t:Math.floor(Date.parse('2026-09-25T12:00:00Z')/1000),...changes});

test('Open Products Facts records remain private candidates with no sales or source rank claim',()=>{
  const result=evaluateOpenProductsFactsRecord(record(),{now});
  assert.equal(result.status,'HUMAN_REVIEW_REQUIRED');
  assert.equal(result.candidate.sourceRank,null);
  assert.equal(result.candidate.salesEvidenceClass,'NONE');
  assert.equal(result.candidate.published,false);
  assert.equal(result.candidate.recordModifiedAt,'2026-09-25T12:00:00.000Z');
});

test('stale, unknown-date, unrelated and established-brand records cannot enter review batch',()=>{
  assert.equal(evaluateOpenProductsFactsRecord(record({last_modified_t:Math.floor(Date.parse('2026-01-01T00:00:00Z')/1000)}),{now}).status,'STALE_RECORD');
  assert.equal(evaluateOpenProductsFactsRecord(record({last_modified_t:null}),{now}).status,'DATE_UNKNOWN');
  assert.equal(evaluateOpenProductsFactsRecord(record({product_name:'Kitchen sponge',categories_tags:['en:kitchen']}),{now}).status,'OUT_OF_NICHE');
  assert.equal(evaluateOpenProductsFactsRecord(record({brands:'Logitech'}),{now}).status,'ESTABLISHED_BRAND');
  assert.equal(evaluateOpenProductsFactsRecord(record({code:'not-a-gtin'}),{now}).status,'INVALID_IDENTITY');
});

test('pilot is bounded, deduplicates barcodes and sorts by record modification date only',()=>{
  const pilot=createOpenProductsFactsPilot({now,maxCandidates:2});
  pilot.add(record({code:'1234567890123',last_modified_t:Math.floor(Date.parse('2026-09-24T12:00:00Z')/1000)}));
  pilot.add(record({code:'2345678901234'}));
  pilot.add(record({code:'1234567890123'}));
  pilot.add(record({code:'3456789012345',last_modified_t:Math.floor(Date.parse('2026-09-26T12:00:00Z')/1000)}));
  pilot.invalidJson();
  const report=pilot.report();
  assert.equal(report.counts.total,5);
  assert.equal(report.candidateCount,2);
  assert.deepEqual(report.candidates.map(row=>row.code),['3456789012345','1234567890123']);
  assert.equal(report.policy.noAutomaticPublication,true);
  assert.equal(report.policy.sourceModifiedIsNotMarketplaceObservation,true);
});

test('CLI streams a gzip export to a private report without publishing products',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'mpr-opf-pilot-'));
  try{
    const input=join(folder,'products.jsonl.gz'),output=join(folder,'report.json');
    await writeFile(input,gzipSync(`${JSON.stringify(record({last_modified_t:Math.floor(Date.now()/1000)}))}\nnot-json\n`));
    const result=execFileSync(process.execPath,['scripts/run-open-products-facts-pilot.mjs','--input',input,'--out',output],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    const report=JSON.parse(await readFile(output,'utf8'));
    assert.equal(report.counts.total,2);
    assert.equal(report.counts.INVALID_JSON,1);
    assert.equal(report.candidateCount,1);
    assert.equal(report.candidates[0].published,false);
    assert.equal(JSON.parse(result).published,0);
  }finally{await rm(folder,{recursive:true,force:true});}
});
