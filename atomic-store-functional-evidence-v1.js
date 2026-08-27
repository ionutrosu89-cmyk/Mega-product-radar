import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {acquireAtomicObservationClaim,validateFencingToken} from './atomic-claim-store-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const iso=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const plusMs=(value,ms)=>{const base=Date.parse(clean(value));return Number.isFinite(base)?new Date(base+ms).toISOString():null;};

export async function runAtomicStoreFunctionalEvidenceDrill(store,options={}){
  if(!store||typeof store.read!=='function'||typeof store.compareAndSet!=='function')throw new Error('ATOMIC_STORE_CONTRACT_REQUIRED');
  const observedAt=iso(options.observedAt||'2026-08-27T12:00:00Z');
  if(!observedAt)throw new Error('OBSERVED_AT_REQUIRED');
  const leaseDurationMs=Math.max(1000,Number(options.leaseDurationMs||1000));
  const inboxFingerprint=clean(options.inboxFingerprint)||`functional-evidence-${deterministicFingerprint({observedAt,scope:store.scope||'UNKNOWN'}).slice(0,16)}`;
  const input={inboxFingerprint,sourceFingerprint:clean(options.sourceFingerprint)||'atomic-functional-evidence-source'};
  const key=clean(options.key)||`atomic-functional-evidence/${inboxFingerprint}`;
  const first=await acquireAtomicObservationClaim(store,input,{key,workerId:'evidence-worker-a',now:observedAt,leaseDurationMs});
  const conflict=await acquireAtomicObservationClaim(store,input,{key,workerId:'evidence-worker-b',now:plusMs(observedAt,Math.floor(leaseDurationMs/2)),leaseDurationMs});
  const reclaimed=await acquireAtomicObservationClaim(store,input,{key,workerId:'evidence-worker-b',now:plusMs(observedAt,leaseDurationMs+1000),leaseDurationMs});
  const stored=await store.read(key);
  const staleFence=validateFencingToken(reclaimed.claim||{},first.claim?.fencingToken);
  const currentFence=validateFencingToken(reclaimed.claim||{},reclaimed.claim?.fencingToken);
  const checks={
    compareAndSetVerified:first.decision==='ACQUIRED'&&first.acquired===true,
    conflictSafetyVerified:conflict.decision==='ACTIVE_CLAIM_CONFLICT'&&conflict.acquired===false,
    fencingMonotonicityVerified:Number(reclaimed.claim?.fencingToken||0)>Number(first.claim?.fencingToken||0)&&staleFence.valid===false&&currentFence.valid===true,
    persistenceReadBackVerified:clean(stored?.claim?.fingerprint)!==''&&clean(stored?.claim?.fingerprint)===clean(reclaimed.claim?.fingerprint)
  };
  const functionalEvidenceVerified=Object.values(checks).every(Boolean);
  const observationMode=upper(options.observationMode||'LOCAL_SIMULATION');
  const environment=clean(options.environment||'local').toLowerCase();
  const adapterKind=upper(store.adapterKind||options.adapterKind||'LOCAL_MEMORY_CAS');
  const adapterId=clean(store.adapterId||options.adapterId)||null;
  const evidenceRef=clean(options.evidenceRef)||null;
  const productionEvidenceEligible=functionalEvidenceVerified&&observationMode==='PRODUCTION_OBSERVED'&&environment==='production'&&upper(store.scope).startsWith('PRODUCTION_')&&Boolean(adapterId)&&Boolean(evidenceRef);
  const payload={
    schema:'MPR_ATOMIC_STORE_FUNCTIONAL_EVIDENCE_V1',
    observationMode,
    environment,
    storeScope:upper(store.scope)||'UNKNOWN',
    adapterKind,
    adapterId,
    evidenceRef,
    observedAt,
    key,
    checks,
    functionalEvidenceVerified,
    productionEvidenceEligible,
    claimSequence:{
      firstDecision:first.decision,
      conflictDecision:conflict.decision,
      reclaimDecision:reclaimed.decision,
      firstFencingToken:Number(first.claim?.fencingToken||0),
      reclaimedFencingToken:Number(reclaimed.claim?.fencingToken||0),
      staleFenceRejected:staleFence.valid===false,
      currentFenceAccepted:currentFence.valid===true
    },
    persistenceRestoreVerified:false,
    exactlyOnceGuaranteed:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,contentSha256:deterministicFingerprint(payload)};
}

export function buildAtomicStoreAttestationCandidateFromFunctionalEvidence(evidence={},review={}){
  const functional= evidence?.schema==='MPR_ATOMIC_STORE_FUNCTIONAL_EVIDENCE_V1'&&evidence.functionalEvidenceVerified===true;
  return{
    observationMode:evidence.observationMode||'LOCAL_SIMULATION',
    environment:evidence.environment||'local',
    adapterKind:evidence.adapterKind||null,
    adapterId:evidence.adapterId||null,
    evidenceRef:clean(review.evidenceRef||evidence.evidenceRef)||null,
    reviewedAt:review.reviewedAt||null,
    reviewer:clean(review.reviewer)||null,
    collectorVersion:clean(review.collectorVersion)||'atomic-store-functional-evidence-v1',
    contentSha256:clean(evidence.contentSha256).toLowerCase(),
    compareAndSetVerified:functional&&evidence.checks?.compareAndSetVerified===true,
    fencingMonotonicityVerified:functional&&evidence.checks?.fencingMonotonicityVerified===true,
    conflictSafetyVerified:functional&&evidence.checks?.conflictSafetyVerified===true,
    persistenceRestoreVerified:false
  };
}
