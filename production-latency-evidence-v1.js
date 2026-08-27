import crypto from 'node:crypto';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}

export function percentile(values=[],p=0.95){
  const sorted=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const rank=Math.max(0,Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1));
  return sorted[rank];
}

export function createLatencySnapshot(input={}){
  const samples=(input.samplesMs||[]).map(Number).filter(value=>Number.isFinite(value)&&value>=0).sort((a,b)=>a-b);
  const payload={
    schema:'MPR_LATENCY_SNAPSHOT_V1',
    observedAt:iso(input.observedAt)||new Date(0).toISOString(),
    collectorVersion:clean(input.collectorVersion)||null,
    runtimeRef:clean(input.runtimeRef)||null,
    operation:clean(input.operation).toUpperCase()||null,
    surface:clean(input.surface).toUpperCase()||null,
    samplesMs:samples,
    sampleCount:samples.length,
    p50Ms:percentile(samples,0.50),
    p95Ms:percentile(samples,0.95),
    p99Ms:percentile(samples,0.99),
    maxMs:samples.length?samples[samples.length-1]:null
  };
  const serialized=JSON.stringify(stable(payload));
  return{...payload,contentSha256:hash(serialized),snapshotFingerprint:deterministicFingerprint(payload)};
}

export function validateLatencyAttestation(input={},snapshot={}){
  const normalized={
    schema:clean(input.schema),
    observationMode:clean(input.observationMode).toUpperCase(),
    environment:clean(input.environment).toLowerCase(),
    sourceKind:clean(input.sourceKind).toUpperCase(),
    evidenceRef:clean(input.evidenceRef)||null,
    observedAt:iso(input.observedAt),
    collectorVersion:clean(input.collectorVersion)||null,
    runtimeRef:clean(input.runtimeRef)||null,
    operation:clean(input.operation).toUpperCase()||null,
    surface:clean(input.surface).toUpperCase()||null,
    contentSha256:clean(input.contentSha256).toLowerCase()||null
  };
  const errors=[];
  if(normalized.schema!=='MPR_LATENCY_ATTESTATION_V1')errors.push('LATENCY_ATTESTATION_SCHEMA_REQUIRED');
  if(normalized.observationMode!=='PRODUCTION_OBSERVED')errors.push('PRODUCTION_OBSERVATION_REQUIRED');
  if(normalized.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(!['PRODUCTION_WORKER_RUNTIME','PRODUCTION_API_RUNTIME','PRODUCTION_PIPELINE_RUNTIME'].includes(normalized.sourceKind))errors.push('PRODUCTION_LATENCY_SOURCE_REQUIRED');
  if(!normalized.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.observedAt)errors.push('OBSERVED_AT_REQUIRED');
  if(!normalized.collectorVersion)errors.push('COLLECTOR_VERSION_REQUIRED');
  if(!normalized.runtimeRef)errors.push('RUNTIME_REF_REQUIRED');
  if(!normalized.operation)errors.push('OPERATION_REQUIRED');
  if(!normalized.surface)errors.push('SURFACE_REQUIRED');
  if(!sha256(normalized.contentSha256))errors.push('CONTENT_SHA256_REQUIRED');
  if(snapshot.contentSha256&&normalized.contentSha256!==snapshot.contentSha256)errors.push('LATENCY_HASH_BINDING_MISMATCH');
  if(snapshot.observedAt&&normalized.observedAt!==snapshot.observedAt)errors.push('LATENCY_OBSERVED_AT_MISMATCH');
  if(snapshot.collectorVersion&&normalized.collectorVersion!==snapshot.collectorVersion)errors.push('LATENCY_COLLECTOR_MISMATCH');
  if(snapshot.runtimeRef&&normalized.runtimeRef!==snapshot.runtimeRef)errors.push('LATENCY_RUNTIME_REF_MISMATCH');
  if(snapshot.operation&&normalized.operation!==snapshot.operation)errors.push('LATENCY_OPERATION_MISMATCH');
  if(snapshot.surface&&normalized.surface!==snapshot.surface)errors.push('LATENCY_SURFACE_MISMATCH');
  return{ok:errors.length===0,errors,attestation:normalized};
}

export function evaluateLatencyEvidence(input={},options={}){
  const snapshot=createLatencySnapshot(input.snapshot||input);
  const attestation=validateLatencyAttestation(input.attestation||{},snapshot);
  const p95LimitMs=Math.max(1,Number(options.p95LimitMs||1000));
  const minSampleCount=Math.max(1,Number(options.minSampleCount||100));
  const sampleCountSufficient=snapshot.sampleCount>=minSampleCount;
  const p95Acceptable=snapshot.p95Ms!==null&&snapshot.p95Ms<=p95LimitMs;
  const localLatencyVerified=sampleCountSufficient&&p95Acceptable;
  const productionP95Verified=localLatencyVerified&&attestation.ok;
  const reasons=[];
  if(!sampleCountSufficient)reasons.push('LATENCY_SAMPLE_COUNT_INSUFFICIENT');
  if(snapshot.p95Ms===null)reasons.push('P95_REQUIRED');
  else if(!p95Acceptable)reasons.push('P95_LIMIT_EXCEEDED');
  if(!attestation.ok)reasons.push(...attestation.errors);
  const evidence={
    schema:'MPR_LATENCY_EVIDENCE_V1',
    decision:productionP95Verified?'PRODUCTION_P95_VERIFIED':'HOLD_PRODUCTION_P95',
    productionP95Verified,
    localLatencyVerified,
    p95Ms:snapshot.p95Ms,
    p95LimitMs,
    minSampleCount,
    sampleCount:snapshot.sampleCount,
    snapshot,
    attestation:attestation.attestation,
    attestationErrors:attestation.errors,
    reasons,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...evidence,evidenceFingerprint:deterministicFingerprint(evidence)};
}
