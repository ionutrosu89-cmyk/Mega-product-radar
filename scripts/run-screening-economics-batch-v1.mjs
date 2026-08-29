import fs from 'node:fs';
import path from 'node:path';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';

const arg=(name,fallback)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
const inputPath=arg('input','data/screening-economics-input-v1.json');
const outPath=arg('out','artifacts/screening-economics-v1.json');
const doc=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const rows=Array.isArray(doc?.rows)?doc.rows:[];
const results=rows.map((row,index)=>({index,canonicalProductId:String(row?.canonicalProductId??'').trim()||null,marketplaceListingId:String(row?.marketplaceListingId??'').trim()||null,supplierListingId:String(row?.supplierListingId??'').trim()||null,...calculateScreeningEconomics(row?.economicsInput||{})}));
const screened=results.filter(x=>x.status==='SCREENED');
const blocked=results.filter(x=>x.status==='BLOCKED');
const profitableConservative=screened.filter(x=>Number(x.scenarios?.conservative?.profitPerUnitRon)>0);
const output={schemaVersion:'MPR_SCREENING_ECONOMICS_BATCH_V1',generatedAt:new Date().toISOString(),inputPath,rows:results.length,screened:screened.length,blocked:blocked.length,profitableConservative:profitableConservative.length,rankingScenario:'CONSERVATIVE',results,truthPolicy:{evidenceClass:'SCREENING_ESTIMATE',confirmedLandedEconomics:false,verifiedSales:false,unknownEqualsZero:false,negotiationIncluded:false,purchaseAuthorized:false},paidCallsTriggered:0,providerSpend:0};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:outPath,rows:output.rows,screened:output.screened,blocked:output.blocked,profitableConservative:output.profitableConservative},null,2));
