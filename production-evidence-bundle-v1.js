import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {buildProductionReadinessSnapshot} from './production-readiness-harness-v1.js';

const clean=value=>String(value??'').trim();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

export function validateCanonicalInventoryEvidence(input={}){
  const normalized={
    schema:clean(input.schema),
    observationMode:clean(input.observationMode).toUpperCase(),
    environment:clean(input.environment).toLowerCase(),
    inventoryClass:clean(input.inventoryClass).toUpperCase(),
    evidenceRef:clean(input.evidenceRef)||null,
    observedAt:iso(input.observedAt),
    collectorVersion:clean(input.collectorVersion)||null,
    contentSha256:clean(input.contentSha256).toLowerCase()||null,
    canonicalCount:Math.max(0,Number(input.canonicalCount||0)),
    logicalDuplicateCount:Math.max(0,Number(input.logicalDuplicateCount||0)),
    provenanceComplete:input.provenanceComplete===true,
    replayDeterministic:input.replayDeterministic===true
  };
  const errors=[];
  if(normalized.schema!=='MPR_CANONICAL_INVENTORY_EVIDENCE_V1')errors.push('CANONICAL_INVENTORY_EVIDENCE_SCHEMA_REQUIRED');
  if(normalized.observationMode!=='PRODUCTION_OBSERVED')errors.push('PRODUCTION_OBSERVATION_REQUIRED');
  if(normalized.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(normalized.inventoryClass!=='REAL_CANONICAL_PRODUCTS')errors.push('REAL_CANONICAL_PRODUCT_INVENTORY_REQUIRED');
  if(!normalized.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.observedAt)errors.push('OBSERVED_AT_REQUIRED');
  if(!normalized.collectorVersion)errors.push('COLLECTOR_VERSION_REQUIRED');
  if(!sha256(normalized.contentSha256))errors.push('CONTENT_SHA256_REQUIRED');
  if(normalized.logicalDuplicateCount!==0)errors.push('ZERO_LOGICAL_DUPLICATES_REQUIRED');
  if(!normalized.provenanceComplete)errors.push('PROVENANCE_COMPLETE_REQUIRED');
  if(!normalized.replayDeterministic)errors.push('REPLAY_DETERMINISM_REQUIRED');
  return{ok:errors.length===0,errors,evidence:normalized};
}

export function createProductionEvidenceBundle(input={}){
  const inventory=validateCanonicalInventoryEvidence(input.canonicalInventoryEvidence||{});
  const bundle={
    schema:'MPR_PRODUCTION_EVIDENCE_BUNDLE_V1',
    bundleRef:clean(input.bundleRef)||null,
    createdAt:iso(input.createdAt)||new Date(0).toISOString(),
    canonicalInventoryEvidence:inventory.evidence,
    persistenceRestoreEvidence:input.persistenceRestoreEvidence||null,
    workerTelemetryEvidence:input.workerTelemetryEvidence||null,
    latencyEvidence:input.latencyEvidence||null,
    inventoryValidation:{ok:inventory.ok,errors:inventory.errors},
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...bundle,bundleFingerprint:deterministicFingerprint(bundle)};
}

export function validateProductionEvidenceBundle(input={}){
  const bundle={...input};
  const fingerprint=clean(bundle.bundleFingerprint);
  delete bundle.bundleFingerprint;
  const fingerprintValid=fingerprint.length>0&&fingerprint===deterministicFingerprint(bundle);
  const inventory=validateCanonicalInventoryEvidence(bundle.canonicalInventoryEvidence||{});
  const safety=Number(bundle.providerDataSpendEur||0)===0&&Number(bundle.paidDataCallsTriggered||0)===0&&bundle.purchaseAuthorized===false&&Number(bundle.verifiedSalesRows||0)===0&&clean(bundle.salesEvidenceClass)==='NOT_VERIFIED_SALES';
  const errors=[];
  if(clean(bundle.schema)!=='MPR_PRODUCTION_EVIDENCE_BUNDLE_V1')errors.push('PRODUCTION_EVIDENCE_BUNDLE_SCHEMA_REQUIRED');
  if(!fingerprintValid)errors.push('PRODUCTION_EVIDENCE_BUNDLE_INTEGRITY_REQUIRED');
  if(!inventory.ok)errors.push(...inventory.errors);
  if(!bundle.persistenceRestoreEvidence)errors.push('PERSISTENCE_RESTORE_EVIDENCE_REQUIRED');
  if(!bundle.workerTelemetryEvidence)errors.push('WORKER_TELEMETRY_EVIDENCE_REQUIRED');
  if(!bundle.latencyEvidence)errors.push('LATENCY_EVIDENCE_REQUIRED');
  if(!safety)errors.push('PRODUCTION_EVIDENCE_BUNDLE_SAFETY_BOUNDARY_FAILED');
  return{ok:errors.length===0,errors,fingerprintValid,inventory:inventory.evidence};
}

export function evaluateProgressiveProductionScale(bundleInput={},options={}){
  const validation=validateProductionEvidenceBundle(bundleInput);
  const bundle=bundleInput||{};
  const inv=validation.inventory||{};
  const input={
    canonicalCount:inv.canonicalCount||0,
    logicalDuplicateCount:inv.logicalDuplicateCount||0,
    provenanceComplete:inv.provenanceComplete===true,
    replayDeterministic:inv.replayDeterministic===true,
    persistenceRestoreEvidence:bundle.persistenceRestoreEvidence,
    workerTelemetryEvidence:bundle.workerTelemetryEvidence,
    latencyEvidence:bundle.latencyEvidence
  };
  const stages=['10K','100K','1M'].map(stage=>{
    const readiness=buildProductionReadinessSnapshot(input,{stage,p95LimitMs:options.p95LimitMs||1000});
    const required=stage==='10K'?10000:stage==='100K'?100000:1000000;
    const realVolumeProven=validation.ok&&Number(inv.canonicalCount||0)>=required;
    return{stage,requiredCanonicalCount:required,realCanonicalProductCount:Number(inv.canonicalCount||0),bundleValid:validation.ok,readinessDecision:readiness.stage.decision,stageAuthorized:validation.ok&&realVolumeProven&&readiness.stage.stageAuthorized,failed:[...validation.errors,...readiness.stage.failed]};
  });
  return{
    schema:'MPR_PROGRESSIVE_PRODUCTION_SCALE_V1',
    decision:stages.every(x=>x.stageAuthorized)?'ALL_STAGES_READY':'HOLD_PROGRESSIVE_SCALE',
    stages,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
}
