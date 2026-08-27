import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {persistCheckpoint} from './production-storage-adapter-v1.js';
import {evaluateWorkerTelemetryEvidence} from './production-worker-telemetry-evidence-v1.js';
import {evaluateLatencyEvidence} from './production-latency-evidence-v1.js';
import {createProductionEvidenceBundle,evaluateProgressiveProductionScale} from './production-evidence-bundle-v1.js';

const clean=value=>String(value??'').trim();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;

export async function collectProductionEvidence(input={},options={}){
  if(!options.storageAdapter)throw new Error('STORAGE_ADAPTER_REQUIRED');
  const collectedAt=iso(input.collectedAt)||new Date(0).toISOString();
  const checkpointReceipt=await persistCheckpoint(options.storageAdapter,clean(input.checkpointKey)||'mpr/ingestion/checkpoint-v1',input.checkpoint||{}, {
    storedAt:collectedAt,
    productionAttestation:input.storageAttestation||{}
  });

  const workerTelemetryEvidence=evaluateWorkerTelemetryEvidence({
    snapshot:input.workerTelemetrySnapshot||{},
    attestation:input.workerTelemetryAttestation||{}
  },options.workerThresholds||{});

  const latencyEvidence=evaluateLatencyEvidence({
    snapshot:input.latencySnapshot||{},
    attestation:input.latencyAttestation||{}
  },options.latencyThresholds||{});

  const canonicalInventoryEvidence={
    schema:'MPR_CANONICAL_INVENTORY_EVIDENCE_V1',
    observationMode:clean(input.inventory?.observationMode||'LOCAL_OBSERVED').toUpperCase(),
    environment:clean(input.inventory?.environment||'local').toLowerCase(),
    inventoryClass:clean(input.inventory?.inventoryClass||'LOCAL_DIAGNOSTIC').toUpperCase(),
    evidenceRef:clean(input.inventory?.evidenceRef)||null,
    observedAt:iso(input.inventory?.observedAt)||collectedAt,
    collectorVersion:clean(input.inventory?.collectorVersion)||'production-evidence-collector-v1',
    contentSha256:clean(input.inventory?.contentSha256).toLowerCase()||null,
    canonicalCount:Math.max(0,Number(input.inventory?.canonicalCount||0)),
    logicalDuplicateCount:Math.max(0,Number(input.inventory?.logicalDuplicateCount||0)),
    provenanceComplete:input.inventory?.provenanceComplete===true,
    replayDeterministic:input.inventory?.replayDeterministic===true
  };

  const persistenceRestoreEvidence=input.persistenceRestoreEvidence||{
    schema:'MPR_PERSISTENCE_RESTORE_EVIDENCE_V1',
    decision:checkpointReceipt.productionPersistenceVerified?'PRODUCTION_RESTORE_VERIFIED':'HOLD_PRODUCTION_RESTORE',
    productionRestoreVerified:checkpointReceipt.productionPersistenceVerified===true,
    localRestoreVerified:checkpointReceipt.localRestoreVerified===true,
    persistedContentSha256:checkpointReceipt.contentSha256,
    restoredContentSha256:checkpointReceipt.localRestoreVerified?checkpointReceipt.contentSha256:null,
    checkpointFingerprint:checkpointReceipt.checkpointFingerprint,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };

  const bundle=createProductionEvidenceBundle({
    bundleRef:clean(input.bundleRef)||`collector:${collectedAt}`,
    createdAt:collectedAt,
    canonicalInventoryEvidence,
    persistenceRestoreEvidence,
    workerTelemetryEvidence,
    latencyEvidence
  });
  const progressiveScale=evaluateProgressiveProductionScale(bundle,{p95LimitMs:options.p95LimitMs||1000});

  const report={
    schema:'MPR_PRODUCTION_EVIDENCE_COLLECTOR_REPORT_V1',
    collectedAt,
    checkpointReceipt,
    bundle,
    progressiveScale,
    productionEvidenceComplete:bundle.canonicalInventoryEvidence?.observationMode==='PRODUCTION_OBSERVED'&&checkpointReceipt.productionPersistenceVerified===true&&workerTelemetryEvidence.queuesStable===true&&latencyEvidence.productionP95Verified===true,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...report,reportFingerprint:deterministicFingerprint(report)};
}
