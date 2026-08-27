import {createHash} from 'node:crypto';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {createIngestionCheckpoint,validateProductionAttestation} from './production-readiness-harness-v1.js';

const clean=value=>String(value??'').trim();
const sha256Hex=value=>createHash('sha256').update(String(value)).digest('hex');
const isSha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

function stableJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
  const keys=Object.keys(value).sort();
  return `{${keys.map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

export function serializeCheckpointForPersistence(input={}){
  const checkpoint=createIngestionCheckpoint(input);
  const bytes=stableJson(checkpoint);
  return{
    schema:'MPR_PERSISTED_CHECKPOINT_V1',
    checkpoint,
    bytes,
    contentSha256:sha256Hex(bytes),
    checkpointFingerprint:checkpoint.checkpointFingerprint
  };
}

export function validatePersistenceRestoreAttestation(input={}){
  const production=validateProductionAttestation(input);
  const normalized={
    ...production.attestation,
    storageKind:clean(input.storageKind).toUpperCase(),
    storageRef:clean(input.storageRef)||null,
    restoreProcedureVersion:clean(input.restoreProcedureVersion)||null,
    persistedContentSha256:clean(input.persistedContentSha256).toLowerCase()||null,
    restoredContentSha256:clean(input.restoredContentSha256).toLowerCase()||null,
    independentReadBack:input.independentReadBack===true
  };
  const errors=[...production.errors];
  if(!['PRODUCTION_DATABASE','PRODUCTION_OBJECT_STORE'].includes(normalized.storageKind))errors.push('PRODUCTION_STORAGE_KIND_REQUIRED');
  if(!normalized.storageRef)errors.push('STORAGE_REF_REQUIRED');
  if(!normalized.restoreProcedureVersion)errors.push('RESTORE_PROCEDURE_VERSION_REQUIRED');
  if(!isSha256(normalized.persistedContentSha256))errors.push('PERSISTED_CONTENT_SHA256_REQUIRED');
  if(!isSha256(normalized.restoredContentSha256))errors.push('RESTORED_CONTENT_SHA256_REQUIRED');
  if(!normalized.independentReadBack)errors.push('INDEPENDENT_READ_BACK_REQUIRED');
  return{
    schema:'MPR_PERSISTENCE_RESTORE_ATTESTATION_VALIDATION_V1',
    valid:errors.length===0,
    decision:errors.length===0?'ATTESTED':'HOLD',
    errors:[...new Set(errors)],
    normalized,
    fingerprint:deterministicFingerprint(normalized)
  };
}

export function evaluatePersistenceRestoreEvidence(input={},options={}){
  const persisted=serializeCheckpointForPersistence(input.persistedCheckpoint||{});
  const restored=serializeCheckpointForPersistence(input.restoredCheckpoint||{});
  const checkpointMatch=persisted.checkpointFingerprint===restored.checkpointFingerprint;
  const contentHashMatch=persisted.contentSha256===restored.contentSha256;
  const expectedPersistedHash=clean(input.persistedContentSha256).toLowerCase();
  const expectedRestoredHash=clean(input.restoredContentSha256).toLowerCase();
  const persistedHashBound=isSha256(expectedPersistedHash)&&expectedPersistedHash===persisted.contentSha256;
  const restoredHashBound=isSha256(expectedRestoredHash)&&expectedRestoredHash===restored.contentSha256;
  const localRestoreVerified=checkpointMatch&&contentHashMatch&&persistedHashBound&&restoredHashBound;
  const attestation=validatePersistenceRestoreAttestation(options.attestation||{});
  const attestationHashesBound=attestation.valid&&
    attestation.normalized.persistedContentSha256===persisted.contentSha256&&
    attestation.normalized.restoredContentSha256===restored.contentSha256;
  const productionRestoreVerified=localRestoreVerified&&attestationHashesBound;
  const reasons=[];
  if(!checkpointMatch)reasons.push('CHECKPOINT_FINGERPRINT_MISMATCH');
  if(!contentHashMatch)reasons.push('CONTENT_HASH_MISMATCH');
  if(!persistedHashBound)reasons.push('PERSISTED_HASH_BINDING_FAILED');
  if(!restoredHashBound)reasons.push('RESTORED_HASH_BINDING_FAILED');
  if(!attestation.valid)reasons.push(...attestation.errors);
  if(attestation.valid&&!attestationHashesBound)reasons.push('ATTESTATION_HASH_BINDING_FAILED');
  return{
    schema:'MPR_PERSISTENCE_RESTORE_EVIDENCE_V1',
    decision:productionRestoreVerified?'PRODUCTION_RESTORE_VERIFIED':'HOLD_PRODUCTION_RESTORE',
    localRestoreVerified,
    productionRestoreVerified,
    checkpointMatch,
    contentHashMatch,
    persistedHashBound,
    restoredHashBound,
    persistedContentSha256:persisted.contentSha256,
    restoredContentSha256:restored.contentSha256,
    checkpointFingerprint:persisted.checkpointFingerprint,
    attestation,
    reasons:[...new Set(reasons)],
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
}
