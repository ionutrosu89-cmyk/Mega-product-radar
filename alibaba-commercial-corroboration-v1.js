const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const priceKey=v=>v&&Number(v.min)>0&&Number(v.max)>0?`${String(v.currency||'USD').toUpperCase()}:${Number(v.min).toFixed(6)}:${Number(v.max).toFixed(6)}`:null;
const moqKey=v=>v&&Number(v.value)>0?String(Number(v.value)):null;
const uniqueNonNull=(rows,getKey)=>{const m=new Map();for(const row of rows){const value=getKey(row);if(!value)continue;m.set(value,row);}return m;};

export const AlibabaCommercialCorroborationTruthPolicy=Object.freeze({
  sameAlibabaExternalIdRequired:true,
  conflictingCommercialEvidenceBecomesUnknown:true,
  corroboratedCommercialEvidenceIsVerifiedQuote:false,
  corroboratedCommercialEvidenceIsDirectSupplierDetail:false,
  corroboratedCommercialEvidenceCanAuthorizeMatch:false,
  corroboratedCommercialEvidenceCanAuthorizeEconomics:false,
  unknownEqualsZero:false,
  purchaseAuthorized:false
});

export function corroborateAlibabaCommercialEvidence(rows=[]){
  const groups=new Map();
  for(const row of rows){
    const id=clean(row?.externalId);
    if(!/^\d{8,}$/.test(id))continue;
    if(String(row?.platform||'ALIBABA').toUpperCase()!=='ALIBABA')continue;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(row);
  }
  const out=[];
  for(const [externalId,items] of groups){
    const embedded=items.filter(x=>x?.evidenceClass==='PUBLIC_SUPPLIER_EMBEDDED_PRODUCT_RECORD_EVIDENCE');
    const identity=(embedded.find(x=>x.exactDistinctiveConfiguration)||embedded[0]||items.find(x=>x.exactDistinctiveConfiguration)||items[0]);
    if(!identity)continue;
    const priceRows=uniqueNonNull(items,x=>priceKey(x.publicPriceCandidate));
    const moqRows=uniqueNonNull(items,x=>moqKey(x.moqCandidate));
    const supplierRows=uniqueNonNull(items,x=>x.supplierName?norm(x.supplierName):null);
    const priceConflict=priceRows.size>1,moqConflict=moqRows.size>1,supplierConflict=supplierRows.size>1;
    const priceSource=!priceConflict&&priceRows.size===1?[...priceRows.values()][0]:null;
    const moqSource=!moqConflict&&moqRows.size===1?[...moqRows.values()][0]:null;
    const supplierSource=!supplierConflict&&supplierRows.size===1?[...supplierRows.values()][0]:null;
    const publicPriceCandidate=priceConflict?null:(priceSource?.publicPriceCandidate??identity.publicPriceCandidate??null);
    const moqCandidate=moqConflict?null:(moqSource?.moqCandidate??identity.moqCandidate??null);
    const supplierName=supplierConflict?null:(supplierSource?.supplierName??identity.supplierName??null);
    out.push({...identity,
      evidenceClass:(publicPriceCandidate||moqCandidate||supplierName)?'PUBLIC_SUPPLIER_INDEX_CORROBORATED_COMMERCIAL_EVIDENCE':identity.evidenceClass,
      publicPriceCandidate,
      moqCandidate,
      supplierName,
      commercialCorroboration:{
        externalId,
        observationCount:items.length,
        sourceUrls:[...new Set(items.map(x=>clean(x.sourceUrl)).filter(Boolean))],
        priceConflict,moqConflict,supplierConflict,
        priceCorroborated:Boolean(priceSource),moqCorroborated:Boolean(moqSource),supplierCorroborated:Boolean(supplierSource)
      },
      detailEvidence:false,
      dimensions:null,
      truthPolicy:{...(identity.truthPolicy||{}),...AlibabaCommercialCorroborationTruthPolicy}
    });
  }
  return out;
}
