import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {verifySupplierQuote} from '../supplier-quote-verifier.js';

export {verifySupplierQuote};

async function main(){
  const inputPath=process.argv[2];
  if(!inputPath){console.error('Usage: node scripts/supplier-quote-verifier.mjs <quote.json> [out.json]');process.exitCode=2;return;}
  const outPath=process.argv[3]||'supplier-quote-verification-live.json';
  const input=JSON.parse(await fs.readFile(inputPath,'utf8'));
  const result=verifySupplierQuote(input);
  const output={...input,...result,verifiedAt:result.verified?input.manualVerifiedAt:null};
  await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
  console.log(`Supplier quote verifier: ${result.evidenceStatus}; blockers=${result.blockers.length}; landedCostEligible=${result.landedCostEligible}.`);
  if(!result.verified)process.exitCode=1;
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await main();
