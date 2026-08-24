import crypto from 'node:crypto';
import {buildUniverseMilestoneStatus} from './global-product-universe-seeder.js';

const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const ASIN=/^[A-Z0-9]{10}$/;

export function loadRealProductBootstrap(compact={}){
  const errors=[];
  if(compact?.schemaVersion!=='MPR_REAL_PRODUCT_BOOTSTRAP_1000_V1')errors.push('SCHEMA_VERSION_INVALID');
  if(compact?.policy?.bootstrapDataIsNotLive!==true)errors.push('BOOTSTRAP_MUST_BE_NOT_LIVE');
  if(compact?.policy?.catalogueBootstrapIsNotRanking!==true)errors.push('BOOTSTRAP_MUST_NOT_BE_RANKING');
  if(Number(compact?.policy?.providerSpendEur)!==0)errors.push('BOOTSTRAP_PROVIDER_SPEND_MUST_BE_ZERO');
  if(Number(compact?.policy?.paidCallsTriggered)!==0)errors.push('BOOTSTRAP_PAID_CALLS_MUST_BE_ZERO');
  if(compact?.policy?.purchaseAuthorized!==false)errors.push('BOOTSTRAP_PURCHASE_MUST_NOT_BE_AUTHORIZED');
  if(Number(compact?.integrity?.canonicalUrlMismatchCount)!==0)errors.push('CANONICAL_URL_INTEGRITY_FAILED');

  const fields=Array.isArray(compact?.fields)?compact.fields:[];
  const required=['asin','title','brand','categoryLabel','price','currency','rating','reviewCount','observedAt','sourceUrlIdentityMatch'];
  for(const name of required)if(!fields.includes(name))errors.push(`FIELD_MISSING:${name}`);
  const index=Object.fromEntries(fields.map((x,i)=>[x,i]));
  const rawRows=Array.isArray(compact?.products)?compact.products:[];
  const productSetSha256=crypto.createHash('sha256').update(JSON.stringify(rawRows)).digest('hex');
  if(!text(compact?.productSetSha256))errors.push('PRODUCT_SET_HASH_REQUIRED');
  else if(productSetSha256!==text(compact.productSetSha256))errors.push('PRODUCT_SET_HASH_MISMATCH');

  const products=[];const rejected=[];const seen=new Set();
  for(let i=0;i<rawRows.length;i++){
    const row=rawRows[i]||[];
    const asin=text(row[index.asin]).toUpperCase();
    const title=text(row[index.title]);
    if(!ASIN.test(asin)){rejected.push({row:i,error:'ASIN_INVALID'});continue;}
    if(!title){rejected.push({row:i,asin,error:'TITLE_REQUIRED'});continue;}
    if(seen.has(asin)){rejected.push({row:i,asin,error:'DUPLICATE_ASIN'});continue;}
    seen.add(asin);
    products.push({
      sourceKey:'AMAZON_OPEN_DATASET_BOOTSTRAP',platform:'AMAZON',surface:'CATALOGUE_BOOTSTRAP',
      externalId:asin,url:`https://www.amazon.com/dp/${asin}`,title,
      brand:text(row[index.brand])||null,categoryLabel:text(row[index.categoryLabel])||null,
      sourceCategoryId:null,sourceRank:null,price:finite(row[index.price]),currency:text(row[index.currency]).toUpperCase()||null,
      rating:finite(row[index.rating]),reviewCount:finite(row[index.reviewCount]),observedAt:text(row[index.observedAt])||null,
      sourceUrlIdentityMatch:row[index.sourceUrlIdentityMatch]===true,
      evidenceClass:'OPEN_PUBLIC_DATASET_PRODUCT',identityEvidence:'AMAZON_NATIVE_ASIN',
      freshnessClass:'BOOTSTRAP_SNAPSHOT_NOT_LIVE',salesEvidenceClass:'NOT_VERIFIED_SALES',
      rankEvidenceClass:'NOT_A_RANKING_OBSERVATION',purchaseAuthorized:false,
      provenance:{source:compact.source||null,productSetSha256}
    });
  }

  if(products.length!==Number(compact?.uniqueProductCount||0))errors.push('DECLARED_PRODUCT_COUNT_MISMATCH');
  if(rejected.length)errors.push('BOOTSTRAP_ROWS_REJECTED');
  const seedResult={uniqueProductObservationCount:products.length};
  return{
    ok:errors.length===0,errors,rejected,products,productSetSha256,
    uniqueProductCount:products.length,
    milestone:buildUniverseMilestoneStatus(seedResult,[1000,5000,10000]),
    coverage:compact?.coverage||null,integrity:compact?.integrity||null,source:compact?.source||null,
    policy:'OPEN_DATASET_BOOTSTRAP_IS_REAL_CATALOGUE_NOT_LIVE_MARKET_INTELLIGENCE',
    paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false
  };
}

export function realProductBootstrapSummary(compact={}){
  const loaded=loadRealProductBootstrap(compact);
  return{
    ok:loaded.ok,uniqueProductCount:loaded.uniqueProductCount,productSetSha256:loaded.productSetSha256,
    milestone:loaded.milestone,coverage:loaded.coverage,integrity:loaded.integrity,source:loaded.source,
    freshnessClass:'BOOTSTRAP_SNAPSHOT_NOT_LIVE',salesEvidenceClass:'NOT_VERIFIED_SALES',
    rankingEvidence:false,paidCallsTriggered:0,purchaseAuthorized:false
  };
}
