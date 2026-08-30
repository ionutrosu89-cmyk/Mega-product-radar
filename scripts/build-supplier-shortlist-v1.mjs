import fs from 'node:fs/promises';
import {buildSupplierShortlist,SupplierShortlistTruthPolicy} from '../supplier-shortlist-v1.js';
const inputPath=process.argv[2]||'supplier-validation-live.json';
const outputPath=process.argv[3]||'supplier-shortlist-live.json';
const src=JSON.parse(await fs.readFile(inputPath,'utf8'));
const shortlist=buildSupplierShortlist(src.candidates||[],5);
const out={schemaVersion:'MPR_SUPPLIER_SHORTLIST_LIVE_V1',updatedAt:new Date().toISOString(),sourceUpdatedAt:src.updatedAt||null,target:src.target||null,integrity:SupplierShortlistTruthPolicy,candidates:shortlist};
await fs.writeFile(outputPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({schemaVersion:out.schemaVersion,candidates:shortlist.map(x=>({externalId:x.externalId,score:x.shortlistScore,moq:x.moq?.value??null,price:x.publicPrice?.max??null,blockers:x.blockers}))},null,2));
