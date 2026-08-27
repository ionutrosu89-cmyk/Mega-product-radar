import {buildCanonicalBatch, deterministicFingerprint} from './data-pipeline-core-v1.js';
import {createEvidenceEnvelopeV2} from './evidence-envelope-v2.js';
import {evaluatePolicyKernel} from './policy-kernel-v1.js';
import {resolveSourceRights} from './source-rights-registry-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export function buildIngestionEvent(input={},options={}){
  const observation=input.observation||input;
  const sourceKey=upper(observation.sourceKey)||'UNREGISTERED_SOURCE';
  const sourceRights=resolveSourceRights(sourceKey,options.sourceRightsOverride||null);
  const collectedAt=clean(input.collectedAt)||new Date().toISOString();
  return{
    schema:'MPR_INGESTION_EVENT_V1',
    eventId:clean(input.eventId)||null,
    runId:clean(input.runId)||'LOCAL_RUN',
    sourceKey,
    collectedAt,
    providerDataSpendEur:Number(input.providerDataSpendEur||0),
    paidDataCallsTriggered:Number(input.paidDataCallsTriggered||0),
    purchaseAuthorized:input.purchaseAuthorized===true||observation.purchaseAuthorized===true,
    sourceRights,
    observation
  };
}

export function processIngestionEvents(events=[],options={}){
  const eventResults=[];
  const acceptedObservations=[];
  for(let index=0;index<events.length;index++){
    const event=buildIngestionEvent(events[index],options);
    const observation=event.observation||{};
    const marketplace=upper(observation.marketplace||observation.platform);
    const externalId=upper(observation.externalId||observation.asin);
    const observedAt=clean(observation.observedAt)||event.collectedAt;
    const envelope=createEvidenceEnvelopeV2({
      expectedIdentity:{marketplace,externalId},
      observedIdentity:{marketplace,externalId},
      source:{
        name:event.sourceKey,
        url:observation.url||null,
        observedAt,
        collectedAt:event.collectedAt,
        parserVersion:clean(options.parserVersion)||'ingestion-pipeline-v1'
      },
      provenance:{
        collector:clean(options.collector)||'mpr-ingestion-pipeline',
        runId:event.runId,
        artifactId:clean(options.artifactId)||null,
        contentSha256:clean(observation.contentSha256||observation?.provenance?.contentSha256)||null
      },
      sourceRights:event.sourceRights,
      evidenceStrength:upper(observation.evidenceStrength)||'SUPPORT_ONLY',
      evidenceClass:upper(observation.evidenceClass)||'OBSERVATION',
      salesEvidenceClass:upper(observation.salesEvidenceClass)||'NOT_VERIFIED_SALES',
      verifiedSalesRows:Number(observation.verifiedSalesRows||0),
      providerDataSpendEur:event.providerDataSpendEur,
      paidDataCallsTriggered:event.paidDataCallsTriggered,
      purchaseAuthorized:event.purchaseAuthorized,
      payload:observation
    });
    const policy=evaluatePolicyKernel(envelope,{intendedUse:options.intendedUse||'analysis'});
    const result={index,event,envelope,policy};
    eventResults.push(result);
    if(policy.decision==='ACCEPT')acceptedObservations.push(observation);
  }
  const canonicalBatch=buildCanonicalBatch(acceptedObservations);
  const manifest={
    schema:'MPR_INGESTION_RUN_MANIFEST_V1',
    inputEventCount:events.length,
    policyAcceptedCount:acceptedObservations.length,
    policyHoldCount:eventResults.filter(x=>x.policy.decision!=='ACCEPT').length,
    canonicalCount:canonicalBatch.manifest.canonicalCount,
    rejectedCanonicalCount:canonicalBatch.manifest.rejectedCount,
    logicalDuplicateCount:canonicalBatch.manifest.logicalDuplicateCount,
    eventDecisionDigest:eventResults.map(x=>({index:x.index,decision:x.policy.decision,reasons:[...(x.policy.reasons||[])]}))
  };
  return{
    manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},
    events:eventResults,
    canonicalBatch
  };
}

export function verifyReplay(first={},second={}){
  const a=clean(first?.manifest?.fingerprint);
  const b=clean(second?.manifest?.fingerprint);
  return{deterministic:Boolean(a&&b&&a===b),firstFingerprint:a||null,secondFingerprint:b||null};
}
