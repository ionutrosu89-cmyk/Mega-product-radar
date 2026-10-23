import {readFile} from 'node:fs/promises';
import {compileTop25Targets} from '../top25-category-approval-v1.js';

const review=JSON.parse(await readFile(new URL('../data/top25-niche-review-v1.json',import.meta.url),'utf8'));
const results=Object.fromEntries(['EBAY_US','EBAY_DE','ALIEXPRESS'].map(provider=>[provider,compileTop25Targets(review,{provider})]));
const errors=Object.values(results).flatMap(result=>result.errors||[]);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exitCode=1;}
else console.log(JSON.stringify({ok:true,configuredNiches:review.niches.length,pilotNicheIds:review.pilotNicheIds,providers:results},null,2));
