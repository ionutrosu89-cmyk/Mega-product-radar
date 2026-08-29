const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const lower=v=>clean(v).toLowerCase();

const SINGLE_ASSEMBLY_TYPES=new Set([
  'desk organizer','file tray organizer','monitor stand','vanity organizer','wall shelf',
  'cable management box','storage container','charging station','wireless charger','can organizer'
]);

function toCm(value,unit){
  const n=Number(value);if(!Number.isFinite(n)||n<=0)return null;
  const u=lower(unit);
  if(u==='mm')return n/10;
  if(u==='m')return n*100;
  if(u.startsWith('in')||u==='"')return n*2.54;
  return n;
}

export function parseRobustDimensions(text){
  const s=clean(text);
  if(!s)return null;
  const patterns=[
    /(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[dDlL]?\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[wW]?\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[hH]?/i,
    /(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inches?|inch|in\b)/i,
    /(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inches?|inch|in\b)/i
  ];
  for(let i=0;i<patterns.length;i++){
    const m=s.match(patterns[i]);if(!m)continue;
    let vals=[];
    if(i===0){
      const inchSignal=/"|\binch(?:es)?\b|\bin\b/i.test(m[0]);
      vals=[m[1],m[2],m[3]].map(v=>toCm(v,inchSignal?'in':'cm'));
    }else{
      const unit=m[i===1?4:3];
      vals=[m[1],m[2],i===1?m[3]:null].filter(Boolean).map(v=>toCm(v,unit));
    }
    if(vals.length>=2&&vals.every(v=>Number.isFinite(v)&&v>0))return {
      lengthCm:Number(vals[0].toFixed(3)),widthCm:Number(vals[1].toFixed(3)),heightCm:vals[2]?Number(vals[2].toFixed(3)):null
    };
  }
  return null;
}

function explicitMultipack(text){
  const s=lower(text);
  const patterns=[/pack\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s*[- ]?pack\b/,/\bset\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s*(?:pcs|pieces|count)\b/];
  for(const p of patterns){const m=s.match(p);if(m&&Number(m[1])>1)return Number(m[1]);}
  return null;
}

export function deriveSupplierSingleUnitPackEvidence({priceUnit,productType,title}={}){
  const unit=lower(priceUnit);
  const type=lower(productType);
  const multi=explicitMultipack(title);
  if(unit!=='piece'&&!/^piece\b/.test(unit))return {packCount:null,derived:false,reason:'PRICE_UNIT_NOT_PIECE'};
  if(multi)return {packCount:null,derived:false,reason:'MULTIPACK_SIGNAL_PRESENT',multipackSignal:multi};
  if(!SINGLE_ASSEMBLY_TYPES.has(type))return {packCount:null,derived:false,reason:'PRODUCT_TYPE_NOT_SINGLE_ASSEMBLY_ALLOWLIST'};
  return {packCount:1,derived:true,reason:'PUBLIC_PRICE_UNIT_PIECE_SINGLE_ASSEMBLY',evidenceClass:'DERIVED_PUBLIC_LISTING_UNIT_EVIDENCE'};
}

export const PublicDetailFusionTruthPolicy=Object.freeze({
  derivedPackCountIsDirectSupplierClaim:false,
  priceUnitPieceAlwaysMeansRetailPackOne:false,
  unknownEqualsZero:false,
  matchingThresholdRelaxed:false,
  purchaseAuthorized:false
});
