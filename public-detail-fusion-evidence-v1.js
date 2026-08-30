const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const lower=v=>clean(v).toLowerCase();

const SINGLE_ASSEMBLY_TYPES=new Set([
  'desk organizer','file tray organizer','monitor stand','vanity organizer','wall shelf',
  'cable management box','storage container','charging station','wireless charger','can organizer'
]);

function decodeDimensionEntities(value){
  return String(value??'')
    .replace(/&quot;|&#34;|&#x0*22;/gi,'"')
    .replace(/&times;|&#215;|&#x0*d7;/gi,'×')
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi,' ');
}

function toCm(value,unit){
  const n=Number(value);if(!Number.isFinite(n)||n<=0)return null;
  const u=lower(unit);
  if(u==='mm')return n/10;
  if(u==='m')return n*100;
  if(u.startsWith('in')||u==='"')return n*2.54;
  return n;
}

function toGrams(value,unit){
  const n=Number(value);if(!Number.isFinite(n)||n<=0)return null;
  const u=lower(unit);
  if(/^kg|kilogram/.test(u))return n*1000;
  if(/^lb|pound/.test(u))return n*453.59237;
  if(/^oz|ounce/.test(u))return n*28.349523125;
  return n;
}

export function parseRobustDimensions(text){
  const s=clean(decodeDimensionEntities(text));if(!s)return null;
  const explicit3=s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inches?|inch|in\b)/i);
  if(explicit3){const vals=[explicit3[1],explicit3[2],explicit3[3]].map(v=>toCm(v,explicit3[4]));return {lengthCm:Number(vals[0].toFixed(3)),widthCm:Number(vals[1].toFixed(3)),heightCm:Number(vals[2].toFixed(3))};}
  const labeled3=s.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[dDlL]?\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[wW]?\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[hH]?/i);
  if(labeled3){const inchSignal=/"|\binch(?:es)?\b|\bin\b/i.test(labeled3[0]);const vals=[labeled3[1],labeled3[2],labeled3[3]].map(v=>toCm(v,inchSignal?'in':'cm'));return {lengthCm:Number(vals[0].toFixed(3)),widthCm:Number(vals[1].toFixed(3)),heightCm:Number(vals[2].toFixed(3))};}
  const explicit2=s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inches?|inch|in\b)/i);
  if(explicit2){const vals=[explicit2[1],explicit2[2]].map(v=>toCm(v,explicit2[3]));return {lengthCm:Number(vals[0].toFixed(3)),widthCm:Number(vals[1].toFixed(3)),heightCm:null};}
  return null;
}

export function parseAmazonExplicitFacts(text){
  const s=clean(decodeDimensionEntities(text));
  if(!s)return {packCount:null,unitWeightGrams:null,packEvidence:null,weightEvidence:null};
  const packPatterns=[
    ['NUMBER_OF_ITEMS',/\bNumber of Items\s+(\d{1,3})\b/i],
    ['ITEM_PACKAGE_QUANTITY',/\bItem Package Quantity\s+(\d{1,3})\b/i],
    ['PACKAGE_QUANTITY',/(?<!Item )\bPackage Quantity\s+(\d{1,3})\b/i]
  ];
  const packs=[];
  for(const [label,re] of packPatterns){const m=s.match(re);if(m){const n=Number(m[1]);if(Number.isInteger(n)&&n>0)packs.push({label,value:n});}}
  const distinct=[...new Set(packs.map(x=>x.value))];
  const packCount=distinct.length===1?distinct[0]:null;
  const packEvidence=packCount===null?null:{direct:true,evidenceClass:'DIRECT_PUBLIC_MARKETPLACE_DETAIL',labels:packs.filter(x=>x.value===packCount).map(x=>x.label)};
  const wm=s.match(/\bItem Weight\s+(\d+(?:\.\d+)?)\s*(kilograms?|kg\b|grams?|g\b|pounds?|lbs?\b|ounces?|oz\b)/i);
  const grams=wm?toGrams(wm[1],wm[2]):null;
  const unitWeightGrams=grams===null?null:Number(grams.toFixed(3));
  const weightEvidence=unitWeightGrams===null?null:{direct:true,evidenceClass:'DIRECT_PUBLIC_MARKETPLACE_DETAIL',label:'ITEM_WEIGHT',raw:wm[0]};
  return {packCount,unitWeightGrams,packEvidence,weightEvidence,packConflict:distinct.length>1?packs:null};
}

export function canonicalMaterialForMatching(value){
  const s=lower(value);if(!s)return null;
  if(/metal|steel|iron|alloy/.test(s))return 'metal';
  if(/plastic|\babs\b|polypropylene|\bpp\b/.test(s))return 'plastic';
  if(/wood|mdf|bamboo/.test(s))return /bamboo/.test(s)?'bamboo':'wood';
  if(/cotton/.test(s))return 'cotton';
  if(/neoprene/.test(s))return 'neoprene';
  if(/acrylic/.test(s))return 'acrylic';
  if(/leather/.test(s))return /faux|\bpu\b/.test(s)?'faux leather':'leather';
  return s;
}

function explicitMultipack(text){
  const s=lower(text);const patterns=[/pack\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s*[- ]?pack\b/,/\bset\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s*(?:pcs|pieces|count)\b/];
  for(const p of patterns){const m=s.match(p);if(m&&Number(m[1])>1)return Number(m[1]);}return null;
}

export function deriveSupplierSingleUnitPackEvidence({priceUnit,productType,title}={}){
  const unit=lower(priceUnit),type=lower(productType),multi=explicitMultipack(title);
  if(unit!=='piece'&&!/^piece\b/.test(unit))return {packCount:null,derived:false,reason:'PRICE_UNIT_NOT_PIECE'};
  if(multi)return {packCount:null,derived:false,reason:'MULTIPACK_SIGNAL_PRESENT',multipackSignal:multi};
  if(!SINGLE_ASSEMBLY_TYPES.has(type))return {packCount:null,derived:false,reason:'PRODUCT_TYPE_NOT_SINGLE_ASSEMBLY_ALLOWLIST'};
  return {packCount:1,derived:true,reason:'PUBLIC_PRICE_UNIT_PIECE_SINGLE_ASSEMBLY',evidenceClass:'DERIVED_PUBLIC_LISTING_UNIT_EVIDENCE'};
}

export const PublicDetailFusionTruthPolicy=Object.freeze({derivedPackCountIsDirectSupplierClaim:false,priceUnitPieceAlwaysMeansRetailPackOne:false,amazonExplicitPackLabelIsDirectEvidence:true,amazonMissingPackLabelMeansOne:false,materialFamilyCanonicalizationDoesNotProveSameProduct:true,unknownEqualsZero:false,matchingThresholdRelaxed:false,purchaseAuthorized:false});
