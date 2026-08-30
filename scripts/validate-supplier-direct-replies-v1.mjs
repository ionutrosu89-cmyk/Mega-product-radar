import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeSupplierDirectReplyEvidence} from '../supplier-direct-reply-evidence-v1.js';

const inputDir=process.argv[2]||'data/supplier-replies';
const outputPath=process.argv[3]||'artifacts/supplier-direct-reply-evidence.json';
let names=[];
try{names=(await fs.readdir(inputDir)).filter(x=>x.endsWith('.json')&&!x.startsWith('_'));}catch(error){if(error?.code!=='ENOENT')throw error;}
const evidence=[];
for(const name of names.sort()){
  const raw=JSON.parse(await fs.readFile(path.join(inputDir,name),'utf8'));
  const normalized=normalizeSupplierDirectReplyEvidence(raw);
  evidence.push({...normalized,inputFile:name});
}
const usable=evidence.filter(x=>x.directIdentityEvidenceUsable);
const output={schemaVersion:'MPR_SUPPLIER_DIRECT_REPLY_BATCH_V1',generatedAt:new Date().toISOString(),inputCount:evidence.length,usableDirectIdentityEvidenceCount:usable.length,integrity:{supplierReplyIsNegotiatedQuote:false,similarProductEvidenceMayTransfer:false,matchingThresholdRelaxed:false,unknownEqualsZero:false,purchaseAuthorized:false},evidence};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({schemaVersion:output.schemaVersion,inputCount:output.inputCount,usableDirectIdentityEvidenceCount:output.usableDirectIdentityEvidenceCount,blockers:evidence.map(x=>({externalId:x.externalId,blockers:x.blockers}))},null,2));
