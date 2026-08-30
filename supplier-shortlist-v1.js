const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const text=v=>String(v??'').trim();
const blockerPenalty=new Map([
  ['DIRECT_SUPPLIER_DIMENSIONS_REQUIRED',40],
  ['DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED',25],
  ['DRAWER_EVIDENCE_REQUIRED',20],
  ['TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED',20],
  ['FIVE_TIER_EVIDENCE_REQUIRED',25],
  ['PEN_HOLDER_EVIDENCE_REQUIRED',20],
  ['ORGANIZER_IDENTITY_EVIDENCE_REQUIRED',30]
]);
const identityBlockers=new Set(['DRAWER_EVIDENCE_REQUIRED','TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED','FIVE_TIER_EVIDENCE_REQUIRED','PEN_HOLDER_EVIDENCE_REQUIRED','ORGANIZER_IDENTITY_EVIDENCE_REQUIRED']);
const identityGapCount=x=>(Array.isArray(x?.blockers)?x.blockers:[]).filter(b=>identityBlockers.has(b)).length;
function commercialScore(x={}){
  const blockers=Array.isArray(x.blockers)?x.blockers:[];
  let score=100;
  for(const b of blockers)score-=blockerPenalty.get(b)??10;
  const moq=finite(x?.moq?.value);
  if(moq===null)score-=8;else if(moq<=10)score+=18;else if(moq<=50)score+=12;else if(moq<=100)score+=8;else if(moq<=500)score+=2;else if(moq>=1000)score-=12;
  const price=finite(x?.publicPrice?.max);
  if(price===null)score-=6;else if(price<=7)score+=8;else if(price<=9)score+=5;else if(price<=12)score+=2;
  if(!text(x.supplierName))score-=5;
  if(x.evidenceClass==='PUBLIC_SUPPLIER_INDEX_CORROBORATED_COMMERCIAL_EVIDENCE')score+=5;
  return Math.max(0,Math.round(score));
}
export function buildSupplierShortlist(candidates=[],limit=5){
  return (Array.isArray(candidates)?candidates:[])
    .filter(x=>x&&x.funnelState==='VALIDATE'&&x.canPromoteToMatch===false&&x.purchaseAuthorized===false)
    .map(x=>({...x,identityGapCount:identityGapCount(x),shortlistScore:commercialScore(x),shortlistStatus:'VALIDATE_ONLY_NOT_MATCHED',economicsAllowed:false}))
    .sort((a,b)=>a.identityGapCount-b.identityGapCount||b.shortlistScore-a.shortlistScore||((finite(a?.moq?.value)??Infinity)-(finite(b?.moq?.value)??Infinity))||text(a.externalId).localeCompare(text(b.externalId)))
    .slice(0,Math.max(1,Number(limit)||5));
}
export const SupplierShortlistTruthPolicy=Object.freeze({
  shortlistIsMarketplaceMatch:false,
  shortlistCanAuthorizeEconomics:false,
  shortlistCanAuthorizePurchase:false,
  identityCompletenessRanksBeforeMoqAndPrice:true,
  lowerMoqCannotOverrideMissingIdentityEvidence:true,
  unknownEqualsZero:false
});
