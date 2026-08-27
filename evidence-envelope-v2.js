const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const iso=value=>{
  const t=Date.parse(String(value??''));
  return Number.isFinite(t)?new Date(t).toISOString():null;
};

function normalizeIdentity(identity={}){
  return{
    canonicalProductId:clean(identity.canonicalProductId)||null,
    marketplace:upper(identity.marketplace)||null,
    externalId:upper(identity.externalId||identity.asin)||null
  };
}

export function createEvidenceEnvelopeV2(input={}){
  const expectedIdentity=normalizeIdentity(input.expectedIdentity||input.identity||{});
  const observedIdentity=normalizeIdentity(input.observedIdentity||input.identity||{});
  const source={
    name:clean(input.source?.name)||null,
    url:clean(input.source?.url)||null,
    observedAt:iso(input.source?.observedAt||input.observedAt),
    collectedAt:iso(input.source?.collectedAt||input.collectedAt),
    parserVersion:clean(input.source?.parserVersion||input.parserVersion)||null
  };
  const provenance={
    collector:clean(input.provenance?.collector)||null,
    runId:clean(input.provenance?.runId)||null,
    artifactId:clean(input.provenance?.artifactId)||null,
    contentSha256:clean(input.provenance?.contentSha256)||null
  };
  const sourceRights={
    analysisAllowed:input.sourceRights?.analysisAllowed===true,
    commercialUseAllowed:input.sourceRights?.commercialUseAllowed===true,
    basis:clean(input.sourceRights?.basis)||null
  };

  return{
    schema:'EvidenceEnvelopeV2',
    version:2,
    evidenceId:clean(input.evidenceId)||null,
    expectedIdentity,
    observedIdentity,
    source,
    provenance,
    sourceRights,
    evidenceStrength:upper(input.evidenceStrength||'SUPPORT_ONLY'),
    evidenceClass:upper(input.evidenceClass||'OBSERVATION'),
    salesEvidenceClass:upper(input.salesEvidenceClass||'NOT_VERIFIED_SALES'),
    verifiedSalesRows:Number.isInteger(input.verifiedSalesRows)&&input.verifiedSalesRows>0?input.verifiedSalesRows:0,
    providerDataSpendEur:Number(input.providerDataSpendEur||0),
    paidDataCallsTriggered:Number(input.paidDataCallsTriggered||0),
    purchaseAuthorized:input.purchaseAuthorized===true,
    payload:input.payload??null
  };
}

export function hasExactEvidenceIdentity(envelope={}){
  const expected=normalizeIdentity(envelope.expectedIdentity||{});
  const observed=normalizeIdentity(envelope.observedIdentity||{});
  if(!expected.marketplace||!expected.externalId||!observed.marketplace||!observed.externalId)return false;
  if(expected.marketplace!==observed.marketplace||expected.externalId!==observed.externalId)return false;
  if(expected.canonicalProductId&&observed.canonicalProductId&&expected.canonicalProductId!==observed.canonicalProductId)return false;
  return true;
}

export function hasStrongEvidenceProvenance(envelope={}){
  const source=envelope.source||{};
  const provenance=envelope.provenance||{};
  return Boolean(
    clean(source.name)&&clean(source.url)&&iso(source.observedAt)&&iso(source.collectedAt)&&clean(source.parserVersion)&&
    clean(provenance.collector)&&clean(provenance.runId)&&clean(provenance.contentSha256)
  );
}
