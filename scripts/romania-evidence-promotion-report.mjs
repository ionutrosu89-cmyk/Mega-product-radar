import fs from 'node:fs/promises';
import path from 'node:path';
import {buildRomaniaEvidencePromotionReport} from '../romania-evidence-promotion-report-v1.js';

const root=process.cwd();
const readJson=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const readOptionalJson=async file=>{try{return await readJson(file);}catch(e){if(e?.code==='ENOENT')return null;throw e;}};

const queue=await readJson('data/romania-comparable-evidence-review-queue-v1.json');
const reviewedBatch=await readJson('data/romania-public-market-evidence-batch-v1.json');
const emagArtifact=await readOptionalJson('artifacts/emag-direct-public-search-probe.json');
const queueItems=queue.items||queue.queue||queue.niches||[];
const report=buildRomaniaEvidencePromotionReport({queueItems,reviewedBatch,emagArtifact});

await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
await fs.writeFile(path.join(root,'artifacts/romania-evidence-promotion-report-v1.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Romania promotion report: ${report.promotable} promotable · ${report.reviewReady} review-ready · ${report.blocked} blocked · eMAG artifact=${report.emagArtifactPresent?'yes':'no'} · paid calls=0.`);
