import {processIngestionEvents,verifyReplay} from './ingestion-pipeline-v1.js';
import {createIngestionCheckpoint} from './production-readiness-harness-v1.js';
import {persistCheckpoint,createMemoryStorageAdapter} from './production-storage-adapter-v1.js';
import {createProductionEvidenceBundle,evaluateProgressiveProductionScale} from './production-evidence-bundle-v1.js';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();

export async function runScaleIngestionWindow(events=[],options={}){
  const runId=clean(options.runId)||'LOCAL_SCALE_WINDOW';
  const ingestionOptions={
    sourceRightsOverride:options.sourceRightsOverride||null,
    parserVersion:clean(options.parserVersion)||'scale-ingestion-orchestrator-v1',
    collector:clean(options.collector)||'mpr-scale-ingestion-orchestrator',
    artifactId:clean(options.artifactId)||null,
    intendedUse:'analysis'
  };
  const first=processIngestionEvents(events.map((event,index)=>({...event,runId,eventId:event.eventId||`${runId}:${index}`})),ingestionOptions);
  const second=processIngestionEvents(events.map((event,index)=>({...event,runId,eventId:event.eventId||`${runId}:${index}`})),ingestionOptions);
  const replay=verifyReplay(first,second);
  const checkpoint=createIngestionCheckpoint({
    runId,
    sequence:Number(options.sequence||1),
    processedCount:first.manifest.inputEventCount,
    canonicalCount:first.manifest.canonicalCount,
    cursor:clean(options.cursor)||`event:${first.manifest.inputEventCount}`,
    ingestionFingerprint:first.manifest.fingerprint,
    artifactContentSha256:clean(options.artifactContentSha256)||'0'.repeat(64)
  });
  const storage=options.storageAdapter||createMemoryStorageAdapter();
  const checkpointReceipt=await persistCheckpoint(storage,clean(options.checkpointKey)||`checkpoints/${runId}`,checkpoint,{storedAt:options.observedAt||'1970-01-01T00:00:00Z',productionAttestation:options.productionStorageAttestation||{}});
  const inventoryEvidence=options.canonicalInventoryEvidence||{
    schema:'MPR_CANONICAL_INVENTORY_EVIDENCE_V1',
    observationMode:'LOCAL_SIMULATION',
    environment:'local',
    inventoryClass:'OBSERVED_WINDOW_ONLY',
    evidenceRef:null,
    observedAt:options.observedAt||'1970-01-01T00:00:00Z',
    collectorVersion:'scale-ingestion-orchestrator-v1',
    contentSha256:'0'.repeat(64),
    canonicalCount:first.manifest.canonicalCount,
    logicalDuplicateCount:first.manifest.logicalDuplicateCount,
    provenanceComplete:false,
    replayDeterministic:replay.deterministic
  };
  const bundle=createProductionEvidenceBundle({
    bundleRef:clean(options.bundleRef)||`bundle://${runId}`,
    createdAt:options.observedAt||'1970-01-01T00:00:00Z',
    canonicalInventoryEvidence:inventoryEvidence,
    persistenceRestoreEvidence:options.persistenceRestoreEvidence||null,
    workerTelemetryEvidence:options.workerTelemetryEvidence||null,
    latencyEvidence:options.latencyEvidence||null
  });
  const progressive=evaluateProgressiveProductionScale(bundle,{p95LimitMs:options.p95LimitMs||1000});
  const report={
    schema:'MPR_SCALE_INGESTION_WINDOW_V1',
    runId,
    ingestionManifest:first.manifest,
    replay,
    checkpoint,
    checkpointReceipt,
    productionEvidenceBundle:bundle,
    progressiveScale:progressive,
    scaleDecision:progressive.decision==='ALL_STAGES_READY'?'SCALE_READY':'HOLD_SCALE',
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...report,reportFingerprint:deterministicFingerprint(report)};
}
