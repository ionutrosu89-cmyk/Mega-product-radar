import {parseRobustDimensions} from './public-detail-fusion-evidence-v1.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const lower=v=>clean(v).toLowerCase();
const decode=s=>String(s??'')
  .replace(/&amp;/gi,'&').replace(/&quot;|&#34;|&#x0*22;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const textOnly=s=>clean(decode(String(s??'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')));

function titleFromHtml(html){
  const s=String(html??'');
  const og=s.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    ??s.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
    ??s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ??'';
  return clean(decode(og))||null;
}

function identitySignals(text){
  const s=lower(text);
  const tier=/\b(?:5|five)\s*[- ]?(?:tier|level|layer)s?\b/.test(s);
  const drawer=/\bdrawer(?:s)?\b/.test(s);
  const twoPen=/\b(?:2|two)\s+(?:pen|pencil)\s+holders?\b/.test(s)||/\b2\s+holders?\s+for\s+(?:pen|pencil)s?\b/.test(s);
  const organizer=/\b(?:desk|desktop|paper|file|letter)\s+(?:tray\s+)?organizer\b|\bfile\s+holder\b|\bpaper\s+tray\b/.test(s);
  const mesh=/\bmesh\b/.test(s);
  const metal=/\bmetal\b|\bsteel\b|\biron\b/.test(s);
  const black=/\bblack\b/.test(s);
  return {fiveTier:tier,drawer,twoPenHolders:twoPen,organizer,mesh,metal,black};
}

function labeledDimensionEvidence(text){
  const s=clean(text);if(!s)return {dimensions:null,evidence:null};
  const labels=['product dimensions','product dimension','product size','item dimensions','item dimension','item size','overall size','size'];
  const sl=s.toLowerCase();
  for(const label of labels){
    let from=0;
    while(true){
      const i=sl.indexOf(label,from);if(i<0)break;
      const window=s.slice(i,Math.min(s.length,i+260));
      const dimensions=parseRobustDimensions(window);
      if(dimensions&&[dimensions.lengthCm,dimensions.widthCm,dimensions.heightCm].filter(v=>Number.isFinite(v)&&v>0).length>=2){
        return {dimensions,evidence:{label,raw:window.slice(0,220),evidenceClass:'DIRECT_PUBLIC_SUPPLIER_DETAIL_DIMENSION_LABEL'}};
      }
      from=i+label.length;
    }
  }
  return {dimensions:null,evidence:null};
}

function publicUsdPriceCandidate(text){
  const s=clean(text);
  const patterns=[
    /(?:US\s*)?\$\s*(\d+(?:\.\d{1,4})?)\s*[-–]\s*(?:US\s*)?\$?\s*(\d+(?:\.\d{1,4})?)/i,
    /\bUSD\s*(\d+(?:\.\d{1,4})?)\s*[-–]\s*(\d+(?:\.\d{1,4})?)/i,
    /(?:US\s*)?\$\s*(\d+(?:\.\d{1,4})?)/i
  ];
  for(const re of patterns){
    const m=s.match(re);if(!m)continue;
    const a=Number(m[1]),b=m[2]?Number(m[2]):a;
    if(a>0&&b>0&&a<10000&&b<10000)return {currency:'USD',min:Math.min(a,b),max:Math.max(a,b),raw:m[0],evidenceClass:'PUBLIC_SUPPLIER_PAGE_PRICE_CANDIDATE_NOT_VERIFIED_QUOTE'};
  }
  return null;
}

function publicMoqCandidate(text){
  const s=clean(text);
  const m=s.match(/\b(?:MOQ|Min\.?\s*Order|Minimum\s+Order(?:\s+Quantity)?)\s*[:：]?\s*(\d{1,7})\s*(?:pieces?|pcs?|sets?|units?)?/i);
  if(!m)return null;
  const value=Number(m[1]);
  return Number.isInteger(value)&&value>0?{value,raw:m[0],evidenceClass:'PUBLIC_SUPPLIER_PAGE_MOQ_CANDIDATE'}:null;
}

export function parseFocusedSupplierDetailHtml(html,{url=null,externalId=null}={}){
  const title=titleFromHtml(html);
  const body=textOnly(html).slice(0,120000);
  const combined=clean([title,body].filter(Boolean).join(' | '));
  const signals=identitySignals(combined);
  const distinctiveConfigConfirmed=signals.fiveTier&&signals.drawer&&signals.twoPenHolders&&signals.organizer;
  const dims=labeledDimensionEvidence(combined);
  const price=publicUsdPriceCandidate(combined);
  const moq=publicMoqCandidate(combined);
  const evidenceScore=(distinctiveConfigConfirmed?50:0)+(dims.dimensions?30:0)+(price?15:0)+(moq?5:0);
  return {
    externalId:externalId??null,url:url??null,title,signals,distinctiveConfigConfirmed,
    dimensions:dims.dimensions,dimensionEvidence:dims.evidence,priceCandidate:price,moqCandidate:moq,
    evidenceScore,
    screeningCandidate:distinctiveConfigConfirmed&&Boolean(dims.dimensions),
    truthPolicy:{
      publicPageIsVerifiedQuote:false,priceCandidateIsNegotiatedPrice:false,priceCandidateIsLandedCost:false,
      dimensionRequiresExplicitProductOrItemSizeLabel:true,titleSimilarityAloneIsMatchEvidence:false,
      missingEvidenceIsZero:false,matchingThresholdRelaxed:false,purchaseAuthorized:false
    }
  };
}

export const FocusedSupplierEvidenceTruthPolicy=Object.freeze({
  exactConfigurationRequired:true,directLabeledDimensionsPreferred:true,publicPriceIsVerifiedQuote:false,
  unknownEqualsZero:false,matchingThresholdRelaxed:false,purchaseAuthorized:false
});
