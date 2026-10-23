import {createReadStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {createGunzip} from 'node:zlib';
import {createOpenProductsFactsPilot} from '../open-products-facts-pilot-v1.js';

const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]||null;};
const input=option('--input'),output=resolve(option('--out')||'artifacts/opf-private-pilot-v1.json');
if(!input)throw new Error('Usage: node scripts/run-open-products-facts-pilot.mjs --input <openproductsfacts-products.jsonl.gz> [--out <private-report.json>]');
const source=createReadStream(resolve(input));
const stream=input.endsWith('.gz')?source.pipe(createGunzip()):source;
const lines=createInterface({input:stream,crlfDelay:Infinity});
const pilot=createOpenProductsFactsPilot();
for await(const line of lines){
  if(!line.trim())continue;
  let row;
  try{row=JSON.parse(line);}catch{pilot.invalidJson();continue;}
  pilot.add(row);
}
const report=pilot.report();
await mkdir(dirname(output),{recursive:true});
await writeFile(output,`${JSON.stringify(report,null,2)}\n`,{flag:'w',mode:0o600});
process.stdout.write(`${JSON.stringify({output,total:report.counts.total,inNiche:report.counts.HUMAN_REVIEW_REQUIRED,recentCandidates:report.candidateCount,published:0})}\n`);
