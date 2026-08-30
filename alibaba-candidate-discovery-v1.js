const clean=v=>String(v??'').trim();
const htmlDecode=s=>clean(s).replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"');

function canonicalAlibabaProductUrl(raw){
  let value=htmlDecode(raw).replace(/\\u002F/gi,'/').replace(/\\\//g,'/').trim();
  if(!value)return null;
  if(value.startsWith('//'))value=`https:${value}`;
  else if(value.startsWith('/product-detail/'))value=`https://www.alibaba.com${value}`;
  else if(value.startsWith('product-detail/'))value=`https://www.alibaba.com/${value}`;
  else if(/^http:/i.test(value))value=value.replace(/^http:/i,'https:');
  if(!/^https:\/\/(?:[a-z0-9-]+\.)?alibaba\.com\/product-detail\//i.test(value))return null;
  const canonical=value.split(/[?#]/)[0];
  return /\.html$/i.test(canonical)?canonical:null;
}

export function extractAlibabaProductCandidates(html,{query=null,sourceUrl=null,limit=50}={}){
  const text=String(html??'');
  const patterns=[
    /https?:\\?\/\\?\/(?:[a-z0-9-]+\.)?alibaba\.com\\?\/product-detail\\?\/[^"'<>\s]+?\.html(?:\?[^"'<>\s]*)?/ig,
    /(?:\\?\/){2}(?:[a-z0-9-]+\.)?alibaba\.com\\?\/product-detail\\?\/[^"'<>\s]+?\.html(?:\?[^"'<>\s]*)?/ig,
    /(?:\\?\/)?product-detail\\?\/[^"'<>\s]+?\.html(?:\?[^"'<>\s]*)?/ig,
    /(?:\\u002F){1,2}product-detail(?:\\u002F)[^"'<>\s]+?\.html/ig
  ];
  const seenRaw=new Set();
  const raws=[];
  for(const pattern of patterns){
    for(const raw of text.match(pattern)||[]){if(!seenRaw.has(raw)){seenRaw.add(raw);raws.push(raw);}}
  }
  const seen=new Set();
  const out=[];
  for(const raw of raws){
    const canonical=canonicalAlibabaProductUrl(raw);
    if(!canonical||seen.has(canonical))continue;
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
