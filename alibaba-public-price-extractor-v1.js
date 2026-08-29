const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const positive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const decode=s=>String(s??'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&yen;/gi,'¥');
const strip=s=>clean(decode(String(s??'').replace(/<[^>]*>/g,' ')));

function currencyCode(raw=''){
  const s=String(raw).toUpperCase();
  if(/\bUSD\b|US\s*\$|\$/.test(s))return'USD';
  if(/\bEUR\b|€/.test(s))return'EUR';
  if(/\bCNY\b|\bRMB\b|CN\s*¥|¥/.test(s))return'CNY';
  return null;
}
function normalizeUnit(raw=''){
  const s=clean(raw).toLowerCase();
  if(/piece|pieces|pc\b|pcs\b/.test(s))return'PIECE';
  if(/set|sets/.test(s))return'SET';
  if(/pair|pairs/.test(s))return'PAIR';
  if(/pack|packs/.test(s))return'PACK';
  return null;
}
function range(a,b){
  const x=positive(String(a??'').replace(/,/g,''));
  const y=positive(String(b??'').replace(/,/g,''));
  if(x===null&&y===null)return null;
  if(x!==null&&y!==null)return{min:Math.min(x,y),max:Math.max(x,y)};
  const v=x??y;return{min:v,max:v};
}
function walk(node,visit){
  if(Array.isArray(node)){for(const x of node)walk(x,visit);return;}
  if(!node||typeof node!=='object')return;
  visit(node);for(const v of Object.values(node))if(v&&typeof v==='object')walk(v,visit);
}
function parseJsonLd(html){
  const hits=[];let m;
  const rx=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while((m=rx.exec(String(html)))){
    try{
      const doc=JSON.parse(decode(m[1]));
      walk(doc,node=>{
        const type=clean(node['@type']).toLowerCase();
        if(type!=='offer'&&type!=='aggregateoffer')return;
        const cur=currencyCode(node.priceCurrency||node.currency||'');
        const r=range(node.lowPrice??node.price,node.highPrice??node.price);
        if(cur&&r)hits.push({currency:cur,...r,method:'JSON_LD_OFFER',confidence:'HIGH'});
      });
    }catch{}
  }
  return hits;
}
function parseTextRange(html){
  const text=strip(html);
  const patterns=[
    /(?:US\s*)?\$\s*([0-9]+(?:\.[0-9]+)?)\s*[-–~]\s*(?:US\s*)?\$?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(piece|pieces|pc|pcs|set|sets|pair|pairs|pack|packs)/i,
    /(?:USD|US\s*\$)\s*([0-9]+(?:\.[0-9]+)?)\s*[-–~]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/|per)\s*(piece|pieces|pc|pcs|set|sets|pair|pairs|pack|packs)/i,
    /(?:CN\s*)?¥\s*([0-9]+(?:\.[0-9]+)?)\s*[-–~]\s*(?:CN\s*)?¥?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(piece|pieces|pc|pcs|set|sets|pair|pairs|pack|packs)/i
  ];
  for(const rx of patterns){
    const m=text.match(rx);if(!m)continue;
    const r=range(m[1],m[2]);const currency=currencyCode(m[0]);const priceUnit=normalizeUnit(m[3]);
    if(r&&currency&&priceUnit)return{currency,...r,priceUnit,method:'VISIBLE_TEXT_RANGE',confidence:'MEDIUM'};
  }
  const single=text.match(/(?:US\s*)?\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(piece|pieces|pc|pcs|set|sets|pair|pairs|pack|packs)/i);
  if(single){const r=range(single[1],single[1]);return{currency:'USD',...r,priceUnit:normalizeUnit(single[2]),method:'VISIBLE_TEXT_SINGLE',confidence:'MEDIUM'};}
  return null;
}
function parseMoq(html){
  const text=strip(html);
  const patterns=[/(?:min\.?\s*order|minimum\s*order(?:\s*quantity)?|moq)\s*[:\-]?\s*([0-9][0-9,]*)\s*(piece|pieces|pc|pcs|set|sets|pair|pairs|pack|packs)/i,/([0-9][0-9,]*)\s*(piece|pieces|pc|pcs|set|sets)\s*\(min\.?\s*order\)/i];
  for(const rx of patterns){const m=text.match(rx);if(m)return{moq:Number(m[1].replace(/,/g,'')),moqUnit:normalizeUnit(m[2])};}
  return{moq:null,moqUnit:null};
}

export function extractAlibabaPublicPrice(html,{sourceUrl=null,observedAt=null}={}){
  const blockers=[];
  const body=String(html??'');
  if(body.length<500)blockers.push('HTML_TOO_SMALL');
  if(/robot|captcha|verify you are human|punish/i.test(body))blockers.push('ANTI_BOT_OR_CHALLENGE');
  const jsonOffers=parseJsonLd(body);
  let selected=null;
  if(jsonOffers.length){
    const currencies=[...new Set(jsonOffers.map(x=>x.currency))];
    if(currencies.length===1){const min=Math.min(...jsonOffers.map(x=>x.min)),max=Math.max(...jsonOffers.map(x=>x.max));selected={currency:currencies[0],min,max,method:'JSON_LD_OFFER',confidence:'HIGH',priceUnit:null};}
    else blockers.push('MULTIPLE_JSON_LD_CURRENCIES');
  }
  const textHit=parseTextRange(body);
  if(!selected&&textHit)selected=textHit;
  if(selected&&selected.priceUnit===null&&textHit&&textHit.currency===selected.currency){selected.priceUnit=textHit.priceUnit;selected.method='JSON_LD_PRICE_WITH_VISIBLE_UNIT';}
  const moq=parseMoq(body);
  if(!selected)blockers.push('PUBLIC_PRICE_NOT_EXTRACTED');
  if(selected&&!selected.priceUnit&&moq.moqUnit)selected.priceUnit=moq.moqUnit;
  if(selected&&!selected.priceUnit)blockers.push('PRICE_UNIT_NOT_EXTRACTED');
  return {
    schemaVersion:'MPR_ALIBABA_PUBLIC_PRICE_EXTRACTION_V1',
    valid:blockers.length===0,
    blockers:[...new Set(blockers)],
    sourceUrl:clean(sourceUrl)||null,
    observedAt:clean(observedAt)||null,
    currency:selected?.currency??null,
    publicPriceMin:selected?.min??null,
    publicPriceMax:selected?.max??null,
    priceUnit:selected?.priceUnit??null,
    moq:moq.moq,
    moqUnit:moq.moqUnit,
    extractionMethod:selected?.method??null,
    confidence:selected?.confidence??'NONE',
    truthPolicy:{publicPagePriceIsVerifiedQuote:false,publicPagePriceIsLandedCost:false,unknownEqualsZero:false,negotiationIncluded:false,purchaseAuthorized:false}
  };
}
