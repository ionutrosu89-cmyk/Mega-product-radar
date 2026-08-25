import fs from 'node:fs/promises';

const src=new URL('../data/romania-public-market-evidence-batch-v1.cleaned.json',import.meta.url);
const out=new URL('../artifacts/romania-scope-count-cleanup-v1.json',import.meta.url);
const data=JSON.parse(await fs.readFile(src,'utf8'));
await fs.mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await fs.writeFile(out,JSON.stringify({...data,generatedAt:new Date().toISOString()},null,2));
console.log(`Romania scope cleanup: ${data.corrections.length} contaminated surfaces retained as surface-only evidence.`);
