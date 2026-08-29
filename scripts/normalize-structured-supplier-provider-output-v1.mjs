import fs from 'node:fs/promises';
import path from 'node:path';
import {adaptStructuredSupplierProviderRows} from '../structured-supplier-provider-adapter-v1.js';

const arg=(name,fallback=null)=>{const hit=process.argv.find(x=>x.startsWith(`--${name}=`));return hit?hit.slice(name.length+3):fallback;};
const input=arg('input');
const out=arg('out','artifacts/structured-supplier-ledger-input-v1.json');
const provider=arg('provider','STRUCTURED_PROVIDER');
const platform=arg('platform','ALIBABA');
if(!input)throw new Error('INPUT_REQUIRED');
const doc=JSON.parse(await fs.readFile(input,'utf8'));
const rows=Array.isArray(doc)?doc:Array.isArray(doc.items)?doc.items:Array.isArray(doc.results)?doc.results:Array.isArray(doc.data)?doc.data:[];
const normalized=adaptStructuredSupplierProviderRows(rows,{provider,platform,observedAt:new Date().toISOString()});
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(normalized,null,2)+'\n');
console.log(JSON.stringify({out,inputRows:rows.length,accepted:normalized.observations.length,rejected:normalized.rejected.length,provider,platform},null,2));
