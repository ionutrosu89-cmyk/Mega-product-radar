import crypto from 'node:crypto';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const normText=value=>upper(value).normalize('NFKC').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const digits=value=>clean(value).replace(/\D/g,'');

export const IDENTITY_NAMESPACE=Object.freeze({
  GTIN:'GTIN',EAN:'EAN',UPC:'UPC',ASIN:'ASIN',MPN:'MPN',EPREL:'EPREL',ICECAT:'ICECAT',SOURCE_PRODUCT_ID:'SOURCE_PRODUCT_ID'
});

export function normalizeGtin(value){
  const d=digits(value);
  if(![8,12,13,14].includes(d.length))return null;
  return d.padStart(14,'0');
}

export function isValidGtin(value){
  const gtin=normalizeGtin(value);
  if(!gtin)return false;
  const ds=gtin.split('').map(Number);
  const check=ds.pop();
  let sum=0;
  for(let i=0;i<ds.length;i++)sum+=ds[i]*((ds.length-i)%2===1?3:1);
  return (10-(sum%10))%10===check;
}

export function normalizeIdentityKey(namespace,value){
  const ns=upper(namespace);
  if(!Object.values(IDENTITY_NAMESPACE).includes(ns))return null;
  if(['GTIN','EAN','UPC'].includes(ns)){
    const gtin=normalizeGtin(value);
    return gtin?{namespace:'GTIN',valueNorm:gtin}:null;
  }
  const v=ns==='ASIN'?upper(value):normText(value);
  return v?{namespace:ns,valueNorm:v}:null;
}

export function strongIdentityKeys(input={}){
  const out=[];
  for(const [ns,value] of [
    ['GTIN',input.gtin],['EAN',input.ean],['UPC',input.upc],['ASIN',input.asin],['MPN',input.mpn],['EPREL',input.eprelId],['ICECAT',input.icecatId]
  ]){
    const k=normalizeIdentityKey(ns,value);
    if(k&&!out.some(x=>x.namespace===k.namespace&&x.valueNorm===k.valueNorm))out.push(k);
  }
  if(input.brand&&input.mpn){
    out.push({namespace:'BRAND_MPN',valueNorm:`${normText(input.brand)}::${normText(input.mpn)}`});
  }
  return out;
}

export function variantSignature(input={}){
  const fields=['color','capacity','size','packSize','model','region'];
  const parts=fields.map(k=>`${k}:${normText(input[k])}`).filter(x=>!x.endsWith(':'));
  return parts.sort().join('|')||null;
}

export function productFingerprint(input={}){
  const payload={
    brand:normText(input.brand),title:normText(input.title),model:normText(input.model),variantSignature:variantSignature(input),
    identities:strongIdentityKeys(input).sort((a,b)=>`${a.namespace}:${a.valueNorm}`.localeCompare(`${b.namespace}:${b.valueNorm}`))
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function resolveCandidatePair(a={},b={}){
  const aKeys=strongIdentityKeys(a),bKeys=strongIdentityKeys(b);
  const exact=aKeys.find(x=>bKeys.some(y=>y.namespace===x.namespace&&y.valueNorm===x.valueNorm));
  const conflicts=[];
  for(const field of ['color','capacity','size','packSize','model']){
    const av=normText(a[field]),bv=normText(b[field]);
    if(av&&bv&&av!==bv)conflicts.push(`HARD_CONFLICT_${field.toUpperCase()}`);
  }
  const aGtin=aKeys.find(x=>x.namespace==='GTIN')?.valueNorm;
  const bGtin=bKeys.find(x=>x.namespace==='GTIN')?.valueNorm;
  if(aGtin&&bGtin&&aGtin!==bGtin)conflicts.push('HARD_CONFLICT_GTIN');
  if(conflicts.length)return{decision:'KEEP_SEPARATE',confidence:1,reasons:conflicts};
  if(exact)return{decision:'AUTO_MERGE',confidence:1,reasons:[`EXACT_${exact.namespace}`]};
  const brandMatch=normText(a.brand)&&normText(a.brand)===normText(b.brand);
  const modelMatch=normText(a.model)&&normText(a.model)===normText(b.model);
  const titleA=new Set(normText(a.title).split(' ').filter(Boolean));
  const titleB=new Set(normText(b.title).split(' ').filter(Boolean));
  const inter=[...titleA].filter(x=>titleB.has(x)).length;
  const union=new Set([...titleA,...titleB]).size||1;
  const titleScore=inter/union;
  const score=Math.min(0.99,(brandMatch?0.35:0)+(modelMatch?0.45:0)+titleScore*0.2);
  if(score>=0.94)return{decision:'AUTO_MERGE',confidence:score,reasons:['FUZZY_THRESHOLD_AUTO']};
  if(score>=0.86)return{decision:'REVIEW',confidence:score,reasons:['FUZZY_THRESHOLD_REVIEW']};
  return{decision:'KEEP_SEPARATE',confidence:score,reasons:['INSUFFICIENT_IDENTITY_CONFIDENCE']};
}
