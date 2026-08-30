const clean=v=>String(v??'').trim();
const normalizeId=v=>{const m=clean(v).match(/\d{8,}/);return m?.[0]||null;};
export const normalizeAlibabaCommercialTitle=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[\u2018\u2019\u201c\u201d]/g,"'").replace(/&amp;/g,'&').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const stable=x=>JSON.stringify(x??null);
const unique=(rows,getter)=>{const map=new Map();for(const row of rows){const value=getter(row);if(value===null||value===undefined||value==='')continue;map.set(stable(value),value);}return [...map.values()];};
const hasCommercial=row=>Boolean(row?.publicPriceCandidate||row?.moqCandidate||clean(row?.supplierName));
const identityWeight=row=>(row?.exactDistinctiveConfiguration?100:row?.partialDistinctiveConfiguration?50:0)+(row?.evidenceClass==='PUBLIC_SUPPLIER_EMBEDDED_PRODUCT_RECORD_EVIDENCE'?20:row?.evidenceClass==='PUBLIC_SUPPLIER_INDEX_CORROBORATED_COMMERCIAL_EVIDENCE'?30:0);

export const AlibabaExactTitleCommercialCorroborationTruthPolicy=Object.freeze({
  exactNormalizedTitleJoin:true,
  exactTitleJoinRequiresSingleEmbeddedExternalId:true,
  alternateExternalIdBlocksTitleJoin:true,
  ambiguousExactTitleBecomesUnknown:true,
  conflictingTitleCommercialEvidenceBecomesUnknown:true,
  exactTitleCommercialEvidenceIsDirectSupplierDetail:false,
  exactTitleCommercialEvidenceIsVerifiedQuote:false,
  exactTitleCommercialEvidenceCanAuthorizeMatch:false,
  exactTitleCommercialEvidenceCanAuthorizeEconomics:false,
  exactTitleCommercialEvidenceCanAuthorizePurchase:false,
  unknownEqualsZero:false,
  purchaseAuthorized:false
});

export function corroborateAlibabaCommercialEvidenceByExactTitle(observations=[]){
  const groups=new Map();
  for(const row of observations){
    const titleKey=normalizeAlibabaCommercialTitle(row?.title);
    if(!titleKey)continue;
    const list=groups.get(titleKey)||[];list.push(row);groups.set(titleKey,list);
  }
  const out=[];
  for(const [titleKey,rows] of groups){
    const embedded=rows.filter(r=>r?.evidenceClass==='PUBLIC_SUPPLIER_EMBEDDED_PRODUCT_RECORD_EVIDENCE'&&normalizeId(r?.externalId));
    const embeddedIds=[...new Set(embedded.map(r=>normalizeId(r.externalId)).filter(Boolean))];
    if(embeddedIds.length!==1)continue;
    const targetId=embeddedIds[0];
    const alternateIds=[...new Set(rows.map(r=>normalizeId(r?.externalId)).filter(id=>id&&id!==targetId))];
    if(alternateIds.length)continue;
    const commercialRows=rows.filter(hasCommercial);
    if(!commercialRows.length)continue;
    const fallbackCommercialRows=commercialRows.filter(r=>!normalizeId(r?.externalId));
    if(!fallbackCommercialRows.length)continue;
    const prices=unique(fallbackCommercialRows,r=>r?.publicPriceCandidate??null);
    const moqs=unique(fallbackCommercialRows,r=>r?.moqCandidate??null);
    const suppliers=unique(fallbackCommercialRows,r=>clean(r?.supplierName)||null);
    const priceConflict=prices.length>1,moqConflict=moqs.length>1,supplierConflict=suppliers.length>1;
    const price=priceConflict?null:(prices[0]??null),moq=moqConflict?null:(moqs[0]??null),supplier=supplierConflict?null:(suppliers[0]??null);
    const identity=[...embedded].sort((a,b)=>identityWeight(b)-identityWeight(a))[0];
    const result={...identity,externalId:targetId,publicPriceCandidate:price,moqCandidate:moq,supplierName:supplier,evidenceClass:'PUBLIC_SUPPLIER_EXACT_TITLE_CORROBORATED_COMMERCIAL_EVIDENCE',detailEvidence:false,dimensions:null,exactTitleCommercialCorroboration:{normalizedTitle:titleKey,exactNormalizedTitleJoin:true,targetExternalId:targetId,alternateExternalIds:[],embeddedExternalIdCount:1,commercialObservationCount:fallbackCommercialRows.length,priceCorroborated:Boolean(price),moqCorroborated:Boolean(moq),supplierCorroborated:Boolean(supplier),priceConflict,moqConflict,supplierConflict,sourceEvidenceClasses:[...new Set(rows.map(r=>clean(r?.evidenceClass)).filter(Boolean))],sourceUrls:[...new Set(fallbackCommercialRows.map(r=>clean(r?.sourceUrl||r?.url)).filter(Boolean))]},truthPolicy:AlibabaExactTitleCommercialCorroborationTruthPolicy};
    out.push(result);
  }
  return out;
}
