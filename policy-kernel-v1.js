import {hasExactEvidenceIdentity,hasStrongEvidenceProvenance} from './evidence-envelope-v2.js';

const upper=value=>String(value??'').trim().toUpperCase();
const finiteNonNegative=value=>Number.isFinite(Number(value))&&Number(value)>=0;

export function evaluateSpendGuard(envelope={}){
  const spend=Number(envelope.providerDataSpendEur??0);
  const paidCalls=Number(envelope.paidDataCallsTriggered??0);
  const ok=finiteNonNegative(spend)&&finiteNonNegative(paidCalls)&&spend===0&&paidCalls===0;
  return{ok,code:ok?'ZERO_COST_CONFIRMED':'PAID_DATA_ACTIVITY_BLOCKED',providerDataSpendEur:spend,paidDataCallsTriggered:paidCalls};
}

export function evaluatePurchaseGuard(envelope={}){
  const requested=envelope.purchaseAuthorized===true;
  return{ok:!requested,code:requested?'PURCHASE_AUTHORIZATION_FORBIDDEN':'PURCHASE_NOT_AUTHORIZED',purchaseAuthorized:false};
}

export function evaluateTruthGuard(envelope={}){
  const salesClass=upper(envelope.salesEvidenceClass||'NOT_VERIFIED_SALES');
  const rows=Number(envelope.verifiedSalesRows||0);
  const verifiedClaim=salesClass==='VERIFIED_SALES';
  const provenanceOk=hasStrongEvidenceProvenance(envelope);
  const ok=!verifiedClaim||(Number.isInteger(rows)&&rows>0&&provenanceOk);
  return{
    ok,
    code:ok?(verifiedClaim?'VERIFIED_SALES_SUPPORTED':'SALES_NOT_CLAIMED_AS_VERIFIED'):'UNSUPPORTED_VERIFIED_SALES_CLAIM',
    salesEvidenceClass:salesClass,
    verifiedSalesRows:Number.isInteger(rows)&&rows>0?rows:0
  };
}

export function evaluateSourceRightsGuard(envelope={},intendedUse='analysis'){
  const rights=envelope.sourceRights||{};
  const use=String(intendedUse||'analysis').trim().toLowerCase();
  const allowed=use==='commercial'?rights.commercialUseAllowed===true:rights.analysisAllowed===true;
  return{ok:allowed,code:allowed?'SOURCE_RIGHTS_CONFIRMED':'SOURCE_RIGHTS_NOT_CONFIRMED',intendedUse:use};
}

export function evaluateIdentityGuard(envelope={}){
  const ok=hasExactEvidenceIdentity(envelope);
  return{ok,code:ok?'EXACT_IDENTITY_CONFIRMED':'IDENTITY_NOT_CONFIRMED'};
}

export function evaluateStrongEvidenceGuard(envelope={}){
  const requested=upper(envelope.evidenceStrength)==='STRONG';
  const provenanceOk=hasStrongEvidenceProvenance(envelope);
  const identityOk=hasExactEvidenceIdentity(envelope);
  const ok=!requested||(provenanceOk&&identityOk);
  return{ok,code:ok?(requested?'STRONG_EVIDENCE_REQUIREMENTS_MET':'STRONG_EVIDENCE_NOT_REQUESTED'):'STRONG_EVIDENCE_REQUIREMENTS_MISSING'};
}

export function evaluatePolicyKernel(envelope={},options={}){
  const intendedUse=options.intendedUse||'analysis';
  const guards={
    spend:evaluateSpendGuard(envelope),
    purchase:evaluatePurchaseGuard(envelope),
    truth:evaluateTruthGuard(envelope),
    sourceRights:evaluateSourceRightsGuard(envelope,intendedUse),
    identity:evaluateIdentityGuard(envelope),
    strongEvidence:evaluateStrongEvidenceGuard(envelope)
  };
  const failed=Object.entries(guards).filter(([,result])=>!result.ok).map(([name,result])=>({guard:name,code:result.code}));
  const accepted=failed.length===0;
  return{
    policyKernelVersion:1,
    decision:accepted?'ACCEPT':'HOLD',
    accepted,
    reasons:failed,
    guards,
    purchaseAuthorized:false,
    scaleAuthorized:accepted,
    monetizationAuthorized:accepted&&String(intendedUse).toLowerCase()==='commercial'
  };
}
