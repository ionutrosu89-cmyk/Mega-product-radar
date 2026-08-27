import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {evaluateRankingEligibility} from './ranking-eligibility-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export function rankingIdentityKey(input={}){
  const envelope=input.envelope||input;
  const marketplace=upper(envelope?.expectedIdentity?.marketplace||envelope?.observedIdentity?.marketplace||input.marketplace||input.platform);
  const externalId=upper(envelope?.expectedIdentity?.externalId||envelope?.observedIdentity?.externalId||input.externalId||input.asin);
  return marketplace&&externalId?`${marketplace}:${externalId}`:null;
}

export function buildRankingSignalRecord(eventResult={},options={}){
  const envelope=eventResult.envelope||{};
  const policy=eventResult.policy||{};
  const eligibility=evaluateRankingEligibility({envelope,policy});
  const identityKey=rankingIdentityKey({envelope});
  const payload={
    schema:'MPR_RANKING_SIGNAL_RECORD_V1',
    runId:clean(options.runId||envelope?.provenance?.runId)||null,
    identityKey,
    marketplace:upper(envelope?.expectedIdentity?.marketplace)||null,
    externalId:upper(envelope?.expectedIdentity?.externalId)||null,
    evidenceClass:upper(envelope?.evidenceClass)||null,
    evidenceStrength:upper(envelope?.evidenceStrength)||null,
    policyDecision:upper(policy?.decision)||null,
    analysisAllowed:envelope?.sourceRights?.analysisAllowed===true,
    exactIdentity:eligibility.exactIdentity===true,
    hasProvenance:eligibility.hasProvenance===true,
    trustedEligible:eligibility.trustedEligible===true,
    eligibilityReasons:[...(eligibility.reasons||[])],
    sourceName:clean(envelope?.source?.name)||null,
    sourceUrl:clean(envelope?.source?.url)||null,
    observedAt:clean(envelope?.source?.observedAt)||null,
    provenance:{
      collector:clean(envelope?.provenance?.collector)||null,
      runId:clean(envelope?.provenance?.runId)||null,
      artifactId:clean(envelope?.provenance?.artifactId)||null,
      contentSha256:clean(envelope?.provenance?.contentSha256)||null
    },
    envelope
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function buildRankingSignalBundle(eventResults=[],options={}){
  const records=(Array.isArray(eventResults)?eventResults:[]).map(x=>buildRankingSignalRecord(x,options));
  const trustedRecords=records.filter(x=>x.trustedEligible&&x.identityKey);
  const heldRecords=records.filter(x=>!x.trustedEligible||!x.identityKey);
  const manifest={
    schema:'MPR_RANKING_SIGNAL_BUNDLE_V1',
    runId:clean(options.runId)||null,
    inputCount:records.length,
    trustedCount:trustedRecords.length,
    heldCount:heldRecords.length,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{
    manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},
    trustedRecords,
    heldRecords
  };
}

function productIdentityKey(product={}){
  const marketplace=upper(product.marketplace||product.platform||product?.identity?.marketplace||product?.amazon?.marketplace||'AMAZON');
  const externalId=upper(product.externalId||product.asin||product?.identity?.externalId||product?.amazon?.asin);
  return marketplace&&externalId?`${marketplace}:${externalId}`:null;
}

function toRankingEvidence(record={}){
  return{
    schema:'MPR_RANKING_EVIDENCE_LINK_V1',
    policyDecision:record.policyDecision,
    evidenceClass:record.evidenceClass,
    analysisAllowed:record.analysisAllowed===true,
    exactIdentity:record.exactIdentity===true,
    hasProvenance:record.hasProvenance===true,
    envelope:record.envelope,
    signalFingerprint:record.fingerprint
  };
}

export function attachTrustedRankingSignals(products=[],bundle={}){
  const trusted=Array.isArray(bundle?.trustedRecords)?bundle.trustedRecords.filter(x=>x?.trustedEligible===true&&x?.identityKey):[];
  const byIdentity=new Map();
  for(const record of trusted){
    if(!byIdentity.has(record.identityKey))byIdentity.set(record.identityKey,[]);
    byIdentity.get(record.identityKey).push(record);
  }
  let attachedSignalCount=0;
  let matchedProductCount=0;
  for(const product of Array.isArray(products)?products:[]){
    const key=productIdentityKey(product);
    const matches=key?byIdentity.get(key)||[]:[];
    if(!matches.length)continue;
    const existing=Array.isArray(product.rankingEvidence)?product.rankingEvidence:[];
    const existingFingerprints=new Set(existing.map(x=>clean(x?.signalFingerprint)).filter(Boolean));
    const additions=matches.filter(x=>!existingFingerprints.has(x.fingerprint)).map(toRankingEvidence);
    if(!additions.length)continue;
    product.rankingEvidence=[...existing,...additions];
    attachedSignalCount+=additions.length;
    matchedProductCount+=1;
  }
  return{
    schema:'MPR_RANKING_SIGNAL_ATTACHMENT_V1',
    trustedInputCount:trusted.length,
    matchedProductCount,
    attachedSignalCount,
    crossPlatformAutoMerge:false
  };
}
