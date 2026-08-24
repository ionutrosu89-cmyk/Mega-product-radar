import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_REPO='luminati-io/Amazon-dataset-samples';
const SOURCE_COMMIT='8259a2c9dc6e513219c3ca0aa02503e103c27ed6';
const SOURCE_BLOB='a3f64e2a96b0c649d7106f9bee7c597a71840e3a';
const SOURCE_URL=`https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}/amazon-products.csv`;
const USER_APPROVAL='USER_APPROVED_1000_REAL_PRODUCTS_2026_08_24';
const generatedAt=new Date().toISOString();

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const target=Math.max(1000,Math.min(1001,Number(args.target)||1000));
const out=String(args.out||'artifacts/real-public-seed-1000.json');

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"')quoted=false;
      else field+=c;
    }else{
      if(c==='"')quoted=true;
      else if(c===','){row.push(field);field='';}
      else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
      else field+=c;
    }
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  return rows;
}

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const num=v=>{const s=clean(v).replace(/[^0-9.,-]/g,'').replace(/,/g,'');if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;};
const amazonUrl=(url,asin)=>{
  const a=clean(asin).toUpperCase();
  const raw=clean(url);
  if(/^https:\/\//i.test(raw)){try{const u=new URL(raw);if(/(^|\.)amazon\./i.test(u.hostname))return raw;}catch{}}
  return /^[A-Z0-9]{10}$/.test(a)?`https://www.amazon.com/dp/${a}`:null;
};

const res=await fetch(SOURCE_URL,{headers:{'user-agent':'MegaProductRadar/1.0 open-dataset-bootstrap'},signal:AbortSignal.timeout(30000)});
if(!res.ok)throw new Error(`SOURCE_HTTP_${res.status}`);
const csv=await res.text();
if(csv.length<100000)throw new Error('SOURCE_DATASET_TOO_SMALL');
const table=parseCsv(csv).filter(r=>r.some(x=>clean(x)));
if(table.length<1001)throw new Error(`SOURCE_ROWS_TOO_FEW_${table.length}`);
const headers=table[0].map((h,i)=>key(h)||`column_${i}`);
const records=table.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));

const aliases={
  asin:['asin','product_asin','parent_asin'],
  title:['title','product_title','name','product_name'],
  url:['url','product_url','product_link','link'],
  category:['category','categories','category_name','product_category'],
  brand:['brand','brand_name'],
  rating:['rating','ratings','stars','rating_value','average_rating'],
  reviews:['reviews_count','review_count','reviews','ratings_count','number_of_ratings','reviews_count'],
  price:['price','final_price','initial_price','price_value'],
  currency:['currency','currency_code'],
  timestamp:['timestamp','collected_at','date','datetime','last_updated']
};
const pick=(r,names)=>{for(const n of names)if(clean(r[n]))return clean(r[n]);return null;};

const observations=[];const rejected=[];const seen=new Set();
for(let index=0;index<records.length&&observations.length<target;index++){
  const r=records[index];
  let asin=pick(r,aliases.asin)?.toUpperCase()||null;
  const rawUrl=pick(r,aliases.url);
  if(!asin&&rawUrl){const m=rawUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);asin=m?.[1]?.toUpperCase()||null;}
  const title=pick(r,aliases.title);
  const url=amazonUrl(rawUrl,asin);
  if(!asin||!/^([A-Z0-9]{10})$/.test(asin)){rejected.push({row:index+2,error:'ASIN_INVALID'});continue;}
  if(!title){rejected.push({row:index+2,asin,error:'TITLE_MISSING'});continue;}
  if(!url){rejected.push({row:index+2,asin,error:'AMAZON_URL_MISSING'});continue;}
  if(seen.has(asin)){rejected.push({row:index+2,asin,error:'DUPLICATE_ASIN'});continue;}
  seen.add(asin);
  observations.push({
    sourceKey:'AMAZON_OPEN_DATASET_BOOTSTRAP',platform:'AMAZON',surface:'CATALOGUE_BOOTSTRAP',externalId:asin,url,title,
    brand:pick(r,aliases.brand),categoryLabel:pick(r,aliases.category),sourceCategoryId:null,sourceRank:null,
    price:num(pick(r,aliases.price)),currency:(pick(r,aliases.currency)||null)?.toUpperCase()||null,
    rating:num(pick(r,aliases.rating)),reviewCount:num(pick(r,aliases.reviews)),
    observedAt:pick(r,aliases.timestamp),
    evidenceClass:'OPEN_PUBLIC_DATASET_PRODUCT',identityEvidence:'AMAZON_NATIVE_ASIN',
    freshnessClass:'BOOTSTRAP_SNAPSHOT_NOT_LIVE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,
    provenance:{sourceRepo:SOURCE_REPO,sourceCommit:SOURCE_COMMIT,sourceBlob:SOURCE_BLOB,sourceFile:'amazon-products.csv',sourceRow:index+2,userApproval:USER_APPROVAL,providerSpendEur:0}
  });
}

const withRating=observations.filter(x=>x.rating!==null).length;
const withReviews=observations.filter(x=>x.reviewCount!==null).length;
const withPrice=observations.filter(x=>x.price!==null).length;
const withCategory=observations.filter(x=>x.categoryLabel).length;
const payload={
  schemaVersion:'REAL_PUBLIC_SEED_1000_OPEN_DATASET_V1',generatedAt,userApproval:USER_APPROVAL,target,
  source:{repo:SOURCE_REPO,commit:SOURCE_COMMIT,blob:SOURCE_BLOB,file:'amazon-products.csv',public:true,declaredSampleSize:1001},
  sourceHeaders:headers,sourceRowCount:records.length,uniqueProductCount:observations.length,rejectedCount:rejected.length,
  coverage:{withRating,withReviews,withPrice,withCategory},rejected,observations,
  policy:{providerSpendEur:0,paidCallsTriggered:0,externalExecutionTriggered:true,executionReason:'EXPLICIT_USER_APPROVAL_TO_REACH_1000_REAL_PRODUCTS',bootstrapDataIsNotLive:true,catalogueBootstrapIsNotRanking:true,salesEvidenceClass:'NOT_VERIFIED_SALES',crossPlatformAutoMerge:false,purchaseAuthorized:false}
};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({sourceRowCount:payload.sourceRowCount,uniqueProductCount:payload.uniqueProductCount,rejectedCount:payload.rejectedCount,coverage:payload.coverage,sourceHeaders:headers},null,2));
if(payload.uniqueProductCount<1000){console.error(`REAL_PRODUCT_TARGET_NOT_REACHED ${payload.uniqueProductCount}/1000`);process.exitCode=2;}
