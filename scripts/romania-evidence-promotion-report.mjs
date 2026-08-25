import fs from 'node:fs/promises';
import path from 'node:path';
import {ingestEmagProbeArtifact} from '../romania-evidence-ingestion-bridge-v1.js';
import {ingestTrendyolReviewedEvidence} from '../trendyol-romania-evidence-ingestion-v1.js';
import {buildRomaniaPromotionReportFromLedger} from '../romania-evidence-promotion-report-v1.js';

const root=process.cwd();
const readJson=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const readOptionalJson=async file=>{try{return await readJson(file);}catch(e){if(e?.code==='ENOENT')return null;throw e;}};

const queue=await readJson('data/romania-comparable-evidence-review-queue-v1.json');
const reviewedBatch=await readJson('data/romania-public-market-evidence-batch-v1.json');
const emagArtifact=await readOptionalJson('artifacts/emag-direct-public-search-probe.json');
const queueItems=queue.items||queue.queue||queue.niches||[];

let ledger={version:'1.3',observations:[]};
const emagIngest=emagArtifact
  ?ingestEmagProbeArtifact({artifact:emagArtifact,ledger})
  :{ledger,appended:0,duplicates:0,diagnosticsSkipped:0};
ledger=emagIngest.ledger;
const trendyolIngest=ingestTrendyolReviewedEvidence({ledger,batch:reviewedBatch});
ledger=trendyolIngest.ledger;

const report=buildRomaniaPromotionReportFromLedger({queueItems,ledger});
const output={
  ...report,
  ingestionSummary:{
    EMAG:{appended:emagIngest.appended||0,duplicates:emagIngest.duplicates||0,diagnosticsSkipped:emagIngest.diagnosticsSkipped||0},
    TRENDYOL:{appended:trendyolIngest.appended||0,duplicates:trendyolIngest.duplicates||0,rejected:trendyolIngest.rejected||0}
  }
};

await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
await fs.writeFile(path.join(root,'artifacts/romania-evidence-promotion-report-v1.json'),JSON.stringify(output,null,2)+'\n');
console.log(`Romania ledger-only promotion report: ${output.promotable} promotable · ${output.reviewReady} review-ready · ${output.blocked} blocked · ledger observations=${output.ledgerObservationCount} · paid calls=0.`);
