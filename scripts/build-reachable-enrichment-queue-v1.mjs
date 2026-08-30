import fs from 'node:fs/promises';
import path from 'node:path';
import {buildReachableEnrichmentQueue} from '../enrichment-reachability-v1.js';

const inputPath=process.argv[2]||'artifacts/current-engine-rematch-top10.json';
const outputPath=process.argv[3]||'artifacts/reachable-enrichment-queue.json';
const workflowRunId=Number(process.argv[4]??0)||null;
const doc=JSON.parse(await fs.readFile(inputPath,'utf8'));
const rows=Array.isArray(doc?.rows)?doc.rows:[];
const queue=buildReachableEnrichmentQueue(rows,{screeningThreshold:80});
queue.source={schemaVersion:doc?.schemaVersion??null,generatedAt:doc?.generatedAt??null,workflowRunId};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(queue,null,2)+'\n');
console.log(JSON.stringify({
  schemaVersion:queue.schemaVersion,
  sourceWorkflowRunId:queue.source.workflowRunId,
  inputPairCount:queue.inputPairCount,
  discardedHardMismatchCount:queue.discardedHardMismatchCount,
  alreadyEligibleCount:queue.alreadyEligibleCount,
  reachableCandidateCount:queue.reachableCandidateCount,
  top:queue.queue.slice(0,5).map(x=>({priority:x.priority,amazonAsin:x.amazonAsin,supplierListingKey:x.supplierListingKey,currentMatchConfidence:x.currentMatchConfidence,optimisticMatchConfidence:x.optimisticMatchConfidence,distinctiveSpecRisk:x.distinctiveSpecRisk,minimumEvidenceSet:x.minimumEvidenceSet}))
},null,2));
