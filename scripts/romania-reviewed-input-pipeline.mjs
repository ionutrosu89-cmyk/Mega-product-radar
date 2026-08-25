import fs from 'node:fs/promises';
import path from 'node:path';
import {runRomaniaReviewedEvidencePipeline} from '../romania-reviewed-input-pipeline-v1.js';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const queue=JSON.parse(await fs.readFile(path.join(root,'data/romania-comparable-evidence-review-queue-v1.json'),'utf8'));
const batch=JSON.parse(await fs.readFile(path.join(root,'data/romania-public-market-evidence-batch-v1.json'),'utf8'));
const inputArg=process.argv[2]||'artifacts/romania-reviewed-input-v1.json';
const inputPath=path.resolve(root,inputArg);
let manualRows=[];
try{
  const input=JSON.parse(await fs.readFile(inputPath,'utf8'));
  manualRows=Array.isArray(input)?input:(input.rows||input.observations||[]);
}catch(err){
  if(err?.code!=='ENOENT')throw err;
}
const result=runRomaniaReviewedEvidencePipeline({
  queueItems:queue.items||[],
  reviewedBatch:batch,
  manualRows
});
const outDir=path.join(root,'artifacts');
await fs.mkdir(outDir,{recursive:true});
const out=path.join(outDir,'romania-reviewed-evidence-pipeline-v1.json');
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(`Romania reviewed pipeline: ${result.ingestion.appended} appended · ${result.ingestion.rejected} rejected · ${result.report.promotable}/${result.report.total} promotable · paid calls ${result.paidCallsTriggered}`);
