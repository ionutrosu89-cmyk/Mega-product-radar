import {buildCanonicalBatch,deterministicFingerprint} from './data-pipeline-core-v1.js';

const EXPECTED_SCHEMA='MPR_AMAZON_LIVE_ROUND1_REMAINING_V1';
const REQUIRED_FIELDS=['asin','title','price','currency','rating','reviewCount','observedAt','statusCode','htmlBytes'];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const finiteOrNull=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

function fieldIndex(fields=[]){
  const index=Object.fromEntries(fields.map((name,i)=>[String(name),i]));
  const missing=REQUIRED_FIELDS.filter(name=>index[name]===undefined);
  if(missing.length)throw new Error(`AMAZON_ROUND1_FIELDS_MISSING:${missing.join(',')}`);
  return index;
}

export function amazonRound1CompactToObservations(payload={},options={}){
  if(payload?.schemaVersion!==EXPECTED_SCHEMA)throw new Error(`AMAZON_ROUND1_SCHEMA_INVALID:${payload?.schemaVersion||'UNKNOWN'}`);
  if(payload?.policy?.purchaseAuthorized===true)throw new Error('AMAZON_ROUND1_PURCHASE_AUTHORIZATION_FORBIDDEN');
  if(String(payload?.policy?.salesEvidenceClass||'NOT_VERIFIED_SALES').toUpperCase()==='VERIFIED_SALES')throw new Error('AMAZON_ROUND1_VERIFIED_SALES_FORBIDDEN');
  const products=Array.isArray(payload.products)?payload.products:[];
  if(!products.length)throw new Error('AMAZON_ROUND1_PRODUCTS_EMPTY');
  const index=fieldIndex(payload.fields);
  const sourceRunId=clean(options.sourceRunId)||null;
  return products.map((row,rowIndex)=>{
    const asin=clean(row[index.asin]).toUpperCase();
    if(!asin)throw new Error(`AMAZON_ROUND1_ASIN_MISSING:${rowIndex}`);
    const observedAt=clean(row[index.observedAt]);
    if(!Number.isFinite(Date.parse(observedAt)))throw new Error(`AMAZON_ROUND1_OBSERVED_AT_INVALID:${asin}`);
    const statusCode=finiteOrNull(row[index.statusCode]);
    if(statusCode!==200)throw new Error(`AMAZON_ROUND1_STATUS_NOT_200:${asin}:${statusCode}`);
    return {
      sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',
      platform:'AMAZON',
      marketplace:'AMAZON',
      externalId:asin,
      surface:'PRODUCT_DETAIL',
      url:`https://www.amazon.com/dp/${asin}`,
      title:clean(row[index.title])||null,
      price:finiteOrNull(row[index.price]),
      currency:clean(row[index.currency])||null,
      rating:finiteOrNull(row[index.rating]),
      reviewCount:finiteOrNull(row[index.reviewCount]),
      observedAt,
      freshnessClass:'LIVE_PUBLIC_PAGE',
      evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      trendAuthorized:false,
      purchaseAuthorized:false,
      provenance:{
        sourceArtifactSchemaVersion:payload.schemaVersion,
        sourceProductSetSha256:clean(payload.productSetSha256)||null,
        sourceRunId,
        statusCode,
        htmlBytes:finiteOrNull(row[index.htmlBytes]),
        sourceCollectorContract:'VALID_LIVE_PAGE_IDENTITY_CONFIRMED_BEFORE_CONSOLIDATION',
        providerSpendEur:0,
        paidCallsTriggered:0
      }
    };
  });
}

export function buildAmazonRound1CanonicalBridge(payload={},options={}){
  const observations=amazonRound1CompactToObservations(payload,options);
  const batch=buildCanonicalBatch(observations);
  if(batch.manifest.logicalDuplicateCount!==0)throw new Error(`AMAZON_ROUND1_LOGICAL_DUPLICATES:${batch.manifest.logicalDuplicateCount}`);
  if(batch.manifest.rejectedCount!==0)throw new Error(`AMAZON_ROUND1_CANONICAL_REJECTIONS:${batch.manifest.rejectedCount}`);
  if(Number(payload.uniqueLiveSnapshots||0)!==observations.length)throw new Error(`AMAZON_ROUND1_COUNT_MISMATCH:${payload.uniqueLiveSnapshots}:${observations.length}`);
  const coverage={
    withPrice:observations.filter(x=>x.price!==null).length,
    withRating:observations.filter(x=>x.rating!==null).length,
    withReviews:observations.filter(x=>x.reviewCount!==null).length
  };
  const sourceCoverage=payload.coverage||{};
  for(const key of Object.keys(coverage))if(Number(sourceCoverage[key]||0)!==coverage[key])throw new Error(`AMAZON_ROUND1_COVERAGE_MISMATCH:${key}:${sourceCoverage[key]}:${coverage[key]}`);
  const manifest={
    sourceSchemaVersion:payload.schemaVersion,
    sourceProductSetSha256:clean(payload.productSetSha256)||null,
    sourceRunId:clean(options.sourceRunId)||null,
    canonicalCount:batch.manifest.canonicalCount,
    rejectedCount:batch.manifest.rejectedCount,
    logicalDuplicateCount:batch.manifest.logicalDuplicateCount,
    coverage
  };
  return {
    schemaVersion:'MPR_AMAZON_ROUND1_CANONICAL_BRIDGE_V1',
    generatedAt:new Date().toISOString(),
    source:manifest,
    manifest:{...batch.manifest,bridgeFingerprint:deterministicFingerprint(manifest)},
    observations,
    accepted:batch.accepted,
    rejected:batch.rejected,
    policy:{
      freshnessClass:'LIVE_PUBLIC_PAGE',
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      trendAuthorized:false,
      crossPlatformAutoMerge:false,
      providerSpendEur:0,
      paidCallsTriggered:0,
      purchaseAuthorized:false,
      scaleAuthorized:false
    }
  };
}
