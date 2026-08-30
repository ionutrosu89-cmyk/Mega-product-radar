const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const decode=s=>String(s??'').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;|&#160;/gi,' ');
const strip=s=>clean(decode(String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')));
const lower=v=>clean(v).toLowerCase();

function canonicalUrl(raw){
  let v=decode(raw).replace(/\\u002F/gi,'/').replace(/\\\//g,'/').trim();
  if(v.startsWith('//'))v=`https:${v}`;
  else if(v.startsWith('/product-detail/'))v=`https://www.alibaba.com${v}`;
  else if(v.startsWith('product-detail/'))v=`https://www.alibaba.com/${v}`;
  if(!/^https?:\/\/(?:[a-z0-9-]+\.)?alibaba\.com\/product-detail\//i.test(v))return null;
  return v.replace(/^http:/i,'https:').split(/[?#]/)[0];
}

function signals(text){
  const s=lower(text);
  return {
    fiveTier:/\b(?:5|five)\s*[- ]?(?:tier|level|layer)s?\b/.test(s),
    drawer:/\b(?:sliding\s+)?drawer(?:s)?\b/.test(s),
    twoPenHolders:/\b(?:2|two)\s+(?:pen|pencil)\s+holders?\b/.test(s)||/\b2\s+holders?\s+for\s+(?:pen|pencil)s?\b/.test(s),
    penHolder:/\b(?:pen|pencil)\s+holders?\b/.test(s),
    organizer:/\bdesk\s+organi[sz]er\b|\bpaper\s+(?:letter\s+)?tray\b|\bfile\s+organi[sz]er\b/.test(s),
    mesh:/\bmesh\b/.test(s),
    black:/\bblack\b/.test(s)
  };
}

function price(text){
  const s=clean(text);
  for(const re of [/(?:US\s*)?\$\s*(\d+(?:\.\d+)?)\s*[-–]\s*(?:US\s*)?\$?\s*(\d+(?:\.\d+)?)/i,/(?:US\s*)?\$\s*(\d+(?:\.\d+)?)/i]){
    const m=s.match(re);if(!m)continue;
    const a=Number(m[1]),b=Number(m[2]??m[1]);
    if(a>0&&b>0&&a<10000&&b<10000)return {currency:'USD',min:Math.min(a,b),max:Math.max(a,b),raw:m[0]};
  }
  return null;
}
function moq(text){
  const m=clean(text).match(/\bMOQ\s*:?\s*(\d{1,7})\s*(?:pieces?|pcs?|sets?|units?)?/i);
  if(!m)return null;const v=Number(m[1]);return v>0?{value:v,raw:m[0]}:null;
}
function supplier(text){
  const s=clean(text);
  const matches=[...s.matchAll(/\b([A-Z][A-Za-z0-9&'().,\- ]{3,90}?(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Technology\s+Co\.?\s*,?\s*Ltd\.?|Trading\s+Co\.?\s*,?\s*Ltd\.?|Factory))\b/g)];
  return matches.length?clean(matches[matches.length-1][1]):null;
}
function titleFromAnchor(anchorHtml){
  const titleAttr=anchorHtml.match(/\btitle=["']([^"']{12,300})["']/i)?.[1];
  if(titleAttr)return clean(decode(titleAttr));
  const inner=anchorHtml.match(/>([\s\S]*?)<\/a\s*>/i)?.[1];
  const t=strip(inner||'');
  return t.length>=12?t:null;
}

export function extractAlibabaIndexEvidence(html,{sourceUrl=null,limit=100}={}){
  const input=String(html??'');
  const anchorRe=/<a\b[^>]*href=["']([^"']*(?:product-detail)[^"']*\.html[^"']*)["'][^>]*>[\s\S]*?<\/a\s*>/ig;
  const rows=[];const seen=new Set();let m;
  while((m=anchorRe.exec(input))&&rows.length<Math.max(1,Number(limit)||100)){
    const url=canonicalUrl(m[1]);if(!url||seen.has(url))continue;seen.add(url);
    const id=url.match(/_(\d{8,})\.html$/i)?.[1]??null;
    const title=titleFromAnchor(m[0]);
    const start=Math.max(0,m.index-1200),end=Math.min(input.length,anchorRe.lastIndex+2600);
    const cardText=strip(input.slice(start,end));
    const evidenceText=clean([title,cardText].filter(Boolean).join(' | '));
    const sig=signals(evidenceText);const p=price(cardText);const q=moq(cardText);const sup=supplier(cardText);
    const exactConfig=sig.fiveTier&&sig.drawer&&sig.twoPenHolders&&sig.organizer;
    const partialConfig=sig.fiveTier&&sig.drawer&&sig.penHolder&&sig.organizer;
    rows.push({
      platform:'ALIBABA',externalId:id,url,title,sourceUrl:sourceUrl??null,supplierName:sup,
      signals:sig,exactDistinctiveConfiguration:exactConfig,partialDistinctiveConfiguration:partialConfig,
      publicPriceCandidate:p,moqCandidate:q,
      evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',
      detailEvidence:false,dimensions:null,
      truthPolicy:{indexCardIsVerifiedQuote:false,indexCardIsDirectSupplierDetail:false,indexCardDimensionsKnown:false,indexCardAloneIsMarketplaceMatch:false,unknownEqualsZero:false,purchaseAuthorized:false}
    });
  }
  return rows;
}

export function rankAlibabaIndexEvidence(rows=[]){
  return [...rows].sort((a,b)=>{
    const ae=a.exactDistinctiveConfiguration?1:a.partialDistinctiveConfiguration?0.5:0;
    const be=b.exactDistinctiveConfiguration?1:b.partialDistinctiveConfiguration?0.5:0;
    if(be!==ae)return be-ae;
    const am=Number(a.moqCandidate?.value??Infinity),bm=Number(b.moqCandidate?.value??Infinity);if(am!==bm)return am-bm;
    const ap=Number(a.publicPriceCandidate?.max??Infinity),bp=Number(b.publicPriceCandidate?.max??Infinity);if(ap!==bp)return ap-bp;
    return String(a.externalId??'').localeCompare(String(b.externalId??''));
  });
}
