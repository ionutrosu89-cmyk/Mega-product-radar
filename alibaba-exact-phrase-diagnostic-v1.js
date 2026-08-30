const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const decode=s=>String(s??'').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;|&#160;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\\u002F/gi,'/').replace(/\\\//g,'/');
const strip=s=>clean(decode(String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')));
const exactPhrase=/five[- ]layer[^<>]{0,180}(?:two|2)\s+(?:pen|pencil)\s+holders?|(?:5|five)[- ]tier[^<>]{0,180}(?:2|two)\s+(?:pen|pencil)\s+holders?/ig;
function canonicalUrl(raw){let v=decode(raw).trim();if(v.startsWith('//'))v=`https:${v}`;else if(v.startsWith('/product-detail/'))v=`https://www.alibaba.com${v}`;if(!/^https?:\/\/(?:[a-z0-9-]+\.)?alibaba\.com\/product-detail\//i.test(v))return null;return v.replace(/^http:/i,'https:').split(/[?#]/)[0];}
function anchors(text){const out=[];const re=/(?:href|productUrl|detailUrl)\s*[=:]\s*["']([^"']*product-detail[^"']*\.html[^"']*)["']/ig;let m;while((m=re.exec(text))){const url=canonicalUrl(m[1]);if(url)out.push({url,index:m.index,externalId:url.match(/_(\d{8,})\.html$/i)?.[1]??null});}return out;}
function supplier(text){const m=strip(text).match(/\b([A-Z][A-Za-z0-9&'().,\- ]{3,90}?(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Technology\s+Co\.?\s*,?\s*Ltd\.?|Trading\s+Co\.?\s*,?\s*Ltd\.?|Factory))\b/);return m?clean(m[1]):null;}
function price(text){const m=strip(text).match(/(?:US\s*)?\$\s*(\d+(?:\.\d+)?)\s*[-–]?\s*(?:US\s*)?\$?\s*(\d+(?:\.\d+)?)?/i);if(!m)return null;const a=Number(m[1]),b=Number(m[2]??m[1]);return a>0&&b>0?{currency:'USD',min:Math.min(a,b),max:Math.max(a,b),raw:m[0]}:null;}
function moq(text){const m=strip(text).match(/\bMOQ\s*:?\s*(\d{1,7})\s*(?:pieces?|pcs?|sets?|units?)?/i);return m&&Number(m[1])>0?{value:Number(m[1]),raw:m[0]}:null;}
export function diagnoseAlibabaExactPhrase(html,{sourceUrl=null,limit=20}={}){
  const input=String(html??''),allAnchors=anchors(input),rows=[];let m;exactPhrase.lastIndex=0;
  while((m=exactPhrase.exec(input))&&rows.length<Math.max(1,Number(limit)||20)){
    const at=m.index,near=allAnchors.filter(a=>Math.abs(a.index-at)<=3500).sort((a,b)=>Math.abs(a.index-at)-Math.abs(b.index-at)).slice(0,4);
    const start=Math.max(0,at-2200),end=Math.min(input.length,at+3200),context=input.slice(start,end);
    rows.push({sourceUrl,phrase:strip(m[0]),phraseIndex:at,nearbyProductAnchors:near.map(a=>({...a,distance:a.index-at})),supplierNameCandidate:supplier(context),publicPriceCandidate:price(context),moqCandidate:moq(context),diagnosticOnly:true,canPromoteToMatch:false,canAuthorizeEconomics:false,purchaseAuthorized:false,truthPolicy:{phraseProximityIsProductIdentity:false,nearbyAnchorIsVerifiedAssociation:false,diagnosticIsMatchEvidence:false,unknownEqualsZero:false}});
  }
  return rows;
}
export const AlibabaExactPhraseDiagnosticTruthPolicy=Object.freeze({diagnosticOnly:true,phraseProximityIsProductIdentity:false,nearbyAnchorIsVerifiedAssociation:false,diagnosticIsMatchEvidence:false,diagnosticCanAuthorizeEconomics:false,diagnosticCanAuthorizePurchase:false,unknownEqualsZero:false});
