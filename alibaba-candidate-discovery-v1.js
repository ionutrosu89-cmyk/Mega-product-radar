const clean=v=>String(v??'').trim();
const htmlDecode=s=>clean(s).replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
const productRe=/https?:\\?\/\\?\/(?:[a-z0-9-]+\.)?alibaba\.com\/product-detail\/[^"'<>\\\s]+?\.html(?:\?[^"'<>\\\s]*)?/ig;

export function extractAlibabaProductCandidates(html,{query=null,sourceUrl=null,limit=50}={}){
  const text=String(html??'');
  const seen=new Set();
  const out=[];
  for(const raw of text.match(productRe)||[]){
    let url=htmlDecode(raw).replace(/\\\//g,'/');
    url=url.replace(/^http:/i,'https:');
    const canonical=url.split('?')[0];
    if(seen.has(canonical))continue;
    seen.add(canonical);
    const id=canonical.match(/_(\d{8,})\.html$/i)?.[1]||null;
    out.push({platform:'ALIBABA',externalId:id,url:canonical,title:null,query:clean(query)||null,discoverySourceUrl:clean(sourceUrl)||null,evidenceClass:'SUPPLIER_CANDIDATE_DISCOVERY_ONLY',supplierPriceVerified:false,matchVerified:false});
    if(out.length>=Math.max(1,Number(limit)||50))break;
  }
  return out;
}

export const AlibabaCandidateDiscoveryTruthPolicy=Object.freeze({
  candidateUrlIsSupplierPriceEvidence:false,
  candidateUrlIsMarketplaceMatch:false,
  candidateUrlIsVerifiedQuote:false,
  unknownEqualsZero:false,
  purchaseAuthorized:false
});
