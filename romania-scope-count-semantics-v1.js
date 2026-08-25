import audit from './data/romania-scope-contamination-audit-v1.json' with {type:'json'};
import {canonicalRomaniaComparabilityKey} from './romania-comparability-key-registry-v1.js';

const keyOf=row=>[
  String(row?.nicheKey||''),
  String(row?.platform||'').toUpperCase(),
  canonicalRomaniaComparabilityKey(row?.comparabilityKey)
].join('|');

const AUDIT=new Map((audit.items||[]).map(x=>[keyOf(x),x]));

export function applyRomaniaScopeCountSemantics(row={}){
  const match=AUDIT.get(keyOf(row));
  if(!match)return {...row};
  const rawLower=row.listingCountLowerBound??null;
  return {
    ...row,
    scope:'PUBLIC_MARKET_SURFACE',
    comparableScopeConfirmed:false,
    listingCountLowerBound:null,
    surfaceItemCountLowerBound:rawLower??match.surfaceItemCountLowerBound??null,
    scopeAuditStatus:match.scopeStatus,
    scopeAuditReason:match.reason
  };
}

export function romanianScopeAuditFor(row={}){
  return AUDIT.get(keyOf(row))||null;
}
