import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateWorkerTelemetryEvidence} from '../production-worker-telemetry-evidence-v1.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputPath=path.resolve(root,process.argv[2]||'artifacts/production-worker-telemetry-evidence.json');
const observedAt='2026-08-27T12:00:00Z';

const snapshot={
  observedAt,
  collectorVersion:'worker-telemetry-local-drill-v1',
  runtimeRef:'local://worker-runtime',
  workers:[
    {id:'local-worker-1',status:'HEALTHY',heartbeatAt:'2026-08-27T11:59:59Z',processed:1000,failed:0,queueDepth:0,oldestMessageAgeMs:0}
  ]
};

const evidence=evaluateWorkerTelemetryEvidence({
  snapshot,
  attestation:{
    schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',
    observationMode:'LOCAL_SIMULATION',
    environment:'local',
    sourceKind:'LOCAL_RUNTIME',
    evidenceRef:'local://worker-telemetry-drill',
    observedAt,
    collectorVersion:snapshot.collectorVersion,
    runtimeRef:snapshot.runtimeRef,
    contentSha256:'0'.repeat(64)
  }
});

const report={
  schema:'MPR_WORKER_TELEMETRY_DRILL_V1',
  evidence,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  productionRuntimeContacted:false,
  productionQueuesStable:false,
  notes:[
    'Local worker telemetry validates health and evidence mechanics only.',
    'No production worker or queue runtime is contacted by this drill.',
    'Local telemetry is not production queue stability evidence.'
  ]
};

if(evidence.localHealthVerified!==true)throw new Error('LOCAL_WORKER_TELEMETRY_HEALTH_EXPECTED');
if(evidence.queuesStable!==false)throw new Error('LOCAL_TELEMETRY_MUST_NOT_AUTHORIZE_PRODUCTION_QUEUES');
if(evidence.decision!=='HOLD_PRODUCTION_QUEUES')throw new Error('LOCAL_TELEMETRY_MUST_HOLD_PRODUCTION_QUEUES');

await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
