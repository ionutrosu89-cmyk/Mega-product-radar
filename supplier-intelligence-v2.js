const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const STRONG=new Set(['VERIFIED','DIRECT_OBSERVED','PROVIDER_VERIFIED','MANUALLY_VERIFIED']);

export const SUPPLIER_DOSSIER_STATES_V2=Object.freeze(['DISCOVERED','LISTING_OBSERVED','CONTACTED','QUOTE_RECEIVED','DOCUMENTED','MANUALLY_VERIFIED','AGENT_VERIFIED']);
const STATE_RANK=Object.freeze(Object.fromEntries(SUPPLIER_DOSSIER_STATES_V2.map((x,i)=>[x,i])));

function stateOf(v){const s=upper(v);return STATE_RANK[s]===undefined?'DISCOVERED':s;}
function fresh(observedAt,now,maxAgeDays=90){const a=Date.parse(text(observedAt)),b=Date.parse(text(now));return Number.isFinite(a)&&Number.isFinite(b)&&b>=a&&b-a<=maxAgeDays*86400000;}
function quoteEvidence(row={},now){
  const q=row.quote||{};
  const evidenceClass=upper(q.evidenceClass)||'UNKNOWN';
  const unitPrice=num(q.unitPrice),moq=num(q.moq);
  const source=text(q.source),observedAt=text(q.observedAt),currency=upper(q.currency);
  const complete=unitPrice!==null&&unitPrice>0&&moq!==null&&moq>0&&Boolean(currency&&source&&observedAt);
  const strong=STRONG.has(evidenceClass);
  const current=fresh(observedAt,now,Number(q.maxAgeDays)||90);
  return Object.freeze({complete,strong,current,evidenceClass,unitPrice,currency:currency||null,moq,observedAt:observedAt||null,source:source||null,sourceUrl:text(q.sourceUrl)||null,incoterm:upper(q.incoterm)||null,sampleCost:num(q.sampleCost),leadTimeDays:num(q.leadTimeDays)});
}

export function normalizeSupplierDossierV2(raw={},canonicalProductId=null,{now=new Date().toISOString()}={}){
  const expected=text(canonicalProductId).toLowerCase()||null;
  const actual=text(raw.canonicalProductId).toLowerCase()||null;
  const state=stateOf(raw.state);
  const quote=quoteEvidence(raw,now);
  const identityMatches=Boolean(expected&&actual&&expected===actual);
  const supplierIdentity=Object.freeze({supplierId:text(raw.supplierId)||null,platform:upper(raw.platform)||null,externalSupplierId:text(raw.externalSupplierId)||null,supplierName:text(raw.supplierName)||null,country:upper(raw.country)||null});
  const documented=STATE_RANK[state]>=STATE_RANK.DOCUMENTED;
  const manuallyVerified=STATE_RANK[state]>=STATE_RANK.MANUALLY_VERIFIED;
  const reasons=[];
  if(!expected)reasons.push('EXPECTED_CANONICAL_PRODUCT_ID_REQUIRED');
  if(!actual)reasons.push('DOSSIER_CANONICAL_PRODUCT_ID_REQUIRED');
  else if(expected&&actual!==expected)reasons.push('CROSS_PRODUCT_SUPPLIER_EVIDENCE_REJECTED');
  if(!supplierIdentity.supplierId&&!supplierIdentity.externalSupplierId&&!supplierIdentity.supplierName)reasons.push('SUPPLIER_IDENTITY_REQUIRED');
  if(STATE_RANK[state]>=STATE_RANK.QUOTE_RECEIVED&&!quote.complete)reasons.push('QUOTE_FIELDS_INCOMPLETE');
  if(STATE_RANK[state]>=STATE_RANK.DOCUMENTED&&!quote.strong)reasons.push('DOCUMENTED_QUOTE_REQUIRES_STRONG_EVIDENCE');
  if(quote.complete&&!quote.current)reasons.push('QUOTE_STALE');
  const dossierEligible=Boolean(identityMatches&&(supplierIdentity.supplierId||supplierIdentity.externalSupplierId||supplierIdentity.supplierName));
  return Object.freeze({schemaVersion:'MPR_SUPPLIER_DOSSIER_V2',canonicalProductId:actual,expectedCanonicalProductId:expected,identityMatches,dossierEligible,state,stateRank:STATE_RANK[state],supplierIdentity,quote,documented,manuallyVerified,agentVerified:state==='AGENT_VERIFIED',reasons:Object.freeze(reasons),purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0});
}

export function analyzeSupplierIntelligenceV2({canonicalProductId=null,dossiers=[],now=new Date().toISOString(),requirements={}}={}){
  const id=text(canonicalProductId).toLowerCase()||null;
  const minDossiers=Math.max(1,Number(requirements.minDossiers)||3);
  const minDocumented=Math.max(1,Number(requirements.minDocumentedQuotes)||1);
  const minCorroborating=Math.max(1,Number(requirements.minCorroboratingSuppliers)||2);
  const normalized=(dossiers||[]).map(x=>normalizeSupplierDossierV2(x,id,{now}));
  const eligible=normalized.filter(x=>x.dossierEligible&&x.identityMatches);
  const uniqueMap=new Map();
  for(const d of eligible){const k=d.supplierIdentity.supplierId||`${d.supplierIdentity.platform||'UNKNOWN'}:${d.supplierIdentity.externalSupplierId||d.supplierIdentity.supplierName}`;const prev=uniqueMap.get(k);if(!prev||d.stateRank>prev.stateRank)uniqueMap.set(k,d);}
  const unique=[...uniqueMap.values()];
  const quoted=unique.filter(x=>x.stateRank>=STATE_RANK.QUOTE_RECEIVED&&x.quote.complete&&x.quote.current);
  const documented=unique.filter(x=>x.stateRank>=STATE_RANK.DOCUMENTED&&x.quote.complete&&x.quote.strong&&x.quote.current);
  const manual=unique.filter(x=>x.stateRank>=STATE_RANK.MANUALLY_VERIFIED&&x.quote.complete&&x.quote.strong&&x.quote.current);
  const rejectedCrossProduct=normalized.filter(x=>x.reasons.includes('CROSS_PRODUCT_SUPPLIER_EVIDENCE_REJECTED')).length;
  const blockers=[];
  if(!id)blockers.push('CANONICAL_PRODUCT_ID_REQUIRED');
  if(unique.length<minDossiers)blockers.push('INSUFFICIENT_SUPPLIER_DOSSIERS');
  if(documented.length<minDocumented)blockers.push('DOCUMENTED_QUOTE_REQUIRED');
  if(quoted.length<minCorroborating)blockers.push('SUPPLIER_CORROBORATION_REQUIRED');
  if(rejectedCrossProduct>0)blockers.push('CROSS_PRODUCT_EVIDENCE_PRESENT');
  const staleQuotes=unique.filter(x=>x.quote.complete&&!x.quote.current).length;
  if(staleQuotes>0)blockers.push('STALE_QUOTES_PRESENT');
  let status='UNKNOWN_FAIL_CLOSED';
  if(id&&unique.length>0)status='REVIEW';
  if(blockers.length===0)status=manual.length>0?'PASS':'REVIEW';
  const confidence=Math.min(100,
    (unique.length>=minDossiers?25:unique.length/minDossiers*25)+
    (quoted.length>=minCorroborating?25:quoted.length/minCorroborating*25)+
    (documented.length>=minDocumented?25:0)+
    (manual.length?20:0)+
    (unique.some(x=>x.agentVerified)?5:0)
  );
  return Object.freeze({
    schemaVersion:'MPR_SUPPLIER_INTELLIGENCE_V2',canonicalProductId:id,status,confidence:Number(confidence.toFixed(2)),supplierGatePassed:status==='PASS',
    metrics:Object.freeze({inputDossiers:normalized.length,uniqueSuppliers:unique.length,quotedSuppliers:quoted.length,documentedSuppliers:documented.length,manuallyVerifiedSuppliers:manual.length,agentVerifiedSuppliers:unique.filter(x=>x.agentVerified).length,rejectedCrossProduct,staleQuotes}),
    requirements:Object.freeze({minDossiers,minDocumentedQuotes:minDocumented,minCorroboratingSuppliers:minCorroborating}),
    dossiers:Object.freeze(normalized),eligibleDossiers:Object.freeze(unique),blockers:Object.freeze([...new Set(blockers)]),
    economicsEligible:status==='PASS'&&documented.length>=1,canPromoteToFinalist:false,canPromoteToTestReady:false,canPromoteToBuyReady:false,purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'EXACT_CANONICAL_PRODUCT_BINDING; DISCOVERY_IS_NOT_VERIFICATION; QUOTE_PROVENANCE_AND_FRESHNESS_REQUIRED; CROSS_PRODUCT_EVIDENCE_REJECTED; MULTI_SUPPLIER_CORROBORATION; SUPPLIER_GATE_NEVER_AUTHORIZES_PURCHASE'
  });
}
