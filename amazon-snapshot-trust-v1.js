import {createEvidenceEnvelopeV2} from './evidence-envelope-v2.js';
import {evaluatePolicyKernel} from './policy-kernel-v1.js';
import {resolveSourceRights} from './source-rights-registry-v1.js';

const clean=value=>String(value??'').trim();
const SOURCE_KEY='AMAZON_PUBLIC_PRODUCT_PAGE';

export function buildAmazonSnapshotTrust(input={},options={}){
  const asin=clean(input.asin).toUpperCase();
  const identityConfirmed=input.identityConfirmed===true;
  const rankEvidenceCount=Number(input.rankEvidenceCount||0);
  const sourceRights=resolveSourceRights(SOURCE_KEY,options.sourceRightsOverride||null);
  const envelope=createEvidenceEnvelopeV2({
    evidenceId:clean(options.evidenceId)||null,
    expectedIdentity:{marketplace:'AMAZON',externalId:asin},
    observedIdentity:identityConfirmed?{marketplace:'AMAZON',externalId:asin}:{marketplace:'AMAZON',externalId:null},
    source:{
      name:SOURCE_KEY,
      url:input.url,
      observedAt:input.observedAt,
      collectedAt:input.collectedAt||input.observedAt,
      parserVersion:'amazon-product-bsr-evidence-v1'
    },
    provenance:{
      collector:'amazon-leader-bsr-snapshot',
      runId:clean(options.runId)||'LOCAL_RUN',
      artifactId:clean(options.artifactId)||null,
      contentSha256:input.contentSha256
    },
    sourceRights,
    evidenceStrength:identityConfirmed&&rankEvidenceCount>0?'STRONG':'SUPPORT_ONLY',
    evidenceClass:rankEvidenceCount>0?'EXPLICIT_PRODUCT_BEST_SELLERS_RANK':'OBSERVATION',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSalesRows:0,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    payload:{
      statusCode:input.statusCode??null,
      htmlBytes:input.htmlBytes??0,
      rankEvidenceCount,
      sourceRightsStatus:sourceRights.status,
      sourceRightsReviewedAt:sourceRights.reviewedAt,
      sourceRightsEvidenceRef:sourceRights.evidenceRef
    }
  });
  const policy=evaluatePolicyKernel(envelope,{intendedUse:options.intendedUse||'analysis'});
  return{envelope,policy,sourceRights};
}
