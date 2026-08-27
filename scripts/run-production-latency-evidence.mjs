import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLatencySnapshot,evaluateLatencyEvidence} from '../production-latency-evidence-v1.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputPath=path.resolve(root,process.argv[2]||'artifacts/production-latency-evidence.json');
const observedAt='2026-08-27T13:00:00Z';
const samplesMs=Array.from({length:100},(_,index)=>80+(index%20));
const snapshotInput={
  observedAt,
  collectorVersion:'latency-local-drill-v1',
  runtimeRef:'local://latency-runtime',
  operation:'INGEST_OBSERVATION',
  surface:'INGESTION_PIPELINE',
  samplesMs
};
const snapshot=createLatencySnapshot(snapshotInput);
const evidence=evaluateLatencyEvidence({snapshot:snapshotInput,attestation:{
  schema:'MPR_LATENCY_ATTESTATION_V1',
  observationMode:'LOCAL_SIMULATION',
  environment:'local',
  sourceKind:'LOCAL_RUNTIME',
  evidenceRef:'local://latency-drill',
  observedAt:snapshot.observedAt,
  collectorVersion:snapshot.collectorVersion,
  runtimeRef:snapshot.runtimeRef,
  operation:snapshot.operation,
  surface:snapshot.surface,
  contentSha256:snapshot.contentSha256
}},{p95LimitMs:1000,minSampleCount:100});

const report={
  schema:'MPR_LATENCY_DRILL_V1',
  evidence,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  productionRuntimeContacted:false,
  productionP95Verified:false,
  notes:[
    'Local latency samples validate percentile and evidence mechanics only.',
    'No production runtime is contacted by this drill.',
    'Local p95 is not production latency evidence.'
  ]
};

if(evidence.localLatencyVerified!==true)throw new Error('LOCAL_LATENCY_EXPECTED_TO_PASS_THRESHOLD');
if(evidence.productionP95Verified!==false)throw new Error('LOCAL_LATENCY_MUST_NOT_AUTHORIZE_PRODUCTION_P95');
if(evidence.decision!=='HOLD_PRODUCTION_P95')throw new Error('LOCAL_LATENCY_MUST_HOLD_PRODUCTION_P95');

await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
