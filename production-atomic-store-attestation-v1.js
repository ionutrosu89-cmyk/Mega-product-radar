import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const iso=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

export const PRODUCTION_ATOMIC_ADAPTER_KINDS=Object.freeze([
  'POSTGRES_TRANSACTIONAL_CAS',
  'OBJECT_STORE_CONDITIONAL_WRITE'
]);

export function validateProductionAtomicStoreAttestation(input={}){
  const normalized={
    schema:'MPR_PRODUCTION_ATOMIC_STORE_ATTESTATION_V1',
    observationMode:clean(input.observationMode).toUpperCase(),
    environment:clean(input.environment).toLowerCase(),
    adapterKind:clean(input.adapterKind).toUpperCase(),
    adapterId:clean(input.adapterId)||null,
    evidenceRef:clean(input.evidenceRef)||null,
    reviewedAt:iso(input.reviewedAt),
    reviewer:clean(input.reviewer)||null,
    collectorVersion:clean(input.collectorVersion)||null,
    contentSha256:clean(input.contentSha256).toLowerCase(),
    compareAndSetVerified:input.compareAndSetVerified===true,
    fencingMonotonicityVerified:input.fencingMonotonicityVerified===true,
    conflictSafetyVerified:input.conflictSafetyVerified===true,
    persistenceRestoreVerified:input.persistenceRestoreVerified===true
  };
  const reasons=[];
  if(normalized.observationMode!=='PRODUCTION_OBSERVED')reasons.push('PRODUCTION_OBSERVATION_REQUIRED');
  if(normalized.environment!=='production')reasons.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(!PRODUCTION_ATOMIC_ADAPTER_KINDS.includes(normalized.adapterKind))reasons.push('SUPPORTED_ATOMIC_ADAPTER_REQUIRED');
  if(!normalized.adapterId)reasons.push('ADAPTER_ID_REQUIRED');
  if(!normalized.evidenceRef)reasons.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.reviewedAt)reasons.push('REVIEWED_AT_REQUIRED');
  if(!normalized.reviewer)reasons.push('REVIEWER_REQUIRED');
  if(!normalized.collectorVersion)reasons.push('COLLECTOR_VERSION_REQUIRED');
  if(!sha256(normalized.contentSha256))reasons.push('CONTENT_SHA256_REQUIRED');
  if(!normalized.compareAndSetVerified)reasons.push('COMPARE_AND_SET_EVIDENCE_REQUIRED');
  if(!normalized.fencingMonotonicityVerified)reasons.push('FENCING_MONOTONICITY_EVIDENCE_REQUIRED');
  if(!normalized.conflictSafetyVerified)reasons.push('CONFLICT_SAFETY_EVIDENCE_REQUIRED');
  if(!normalized.persistenceRestoreVerified)reasons.push('PERSISTENCE_RESTORE_EVIDENCE_REQUIRED');
  return{
    schema:'MPR_PRODUCTION_ATOMIC_STORE_ATTESTATION_VALIDATION_V1',
    normalized,
    valid:reasons.length===0,
    decision:reasons.length===0?'ATTESTED':'HOLD',
    reasons,
    fingerprint:deterministicFingerprint(normalized)
  };
}

export function evaluateProductionAtomicStoreReadiness(store={},attestation={}){
  const validation=validateProductionAtomicStoreAttestation(attestation);
  const scope=clean(store.scope).toUpperCase();
  const storeContractOk=typeof store.read==='function'&&typeof store.compareAndSet==='function';
  const productionScope=scope.startsWith('PRODUCTION_');
  const adapterKindMatches=clean(store.adapterKind).toUpperCase()===validation.normalized.adapterKind;
  const adapterIdMatches=clean(store.adapterId)===clean(validation.normalized.adapterId);
  const productionAtomicityVerified=validation.valid&&storeContractOk&&productionScope&&adapterKindMatches&&adapterIdMatches;
  const reasons=[];
  if(!validation.valid)reasons.push(...validation.reasons);
  if(!storeContractOk)reasons.push('ATOMIC_STORE_CONTRACT_REQUIRED');
  if(!productionScope)reasons.push('PRODUCTION_STORE_SCOPE_REQUIRED');
  if(!adapterKindMatches)reasons.push('ADAPTER_KIND_MISMATCH');
  if(!adapterIdMatches)reasons.push('ADAPTER_ID_MISMATCH');
  return{
    schema:'MPR_PRODUCTION_ATOMIC_STORE_READINESS_V1',
    decision:productionAtomicityVerified?'PRODUCTION_ATOMICITY_VERIFIED':'HOLD_PRODUCTION_ATOMICITY',
    productionAtomicityVerified,
    distributedLockingVerified:productionAtomicityVerified,
    exactlyOnceGuaranteed:false,
    storeScope:scope||'UNKNOWN',
    attestation:validation,
    reasons:[...new Set(reasons)],
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
}
