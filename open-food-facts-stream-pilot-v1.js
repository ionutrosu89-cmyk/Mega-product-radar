import crypto from 'node:crypto';
import {isValidGtin} from './canonical-identity-v2.js';

export const OFFICIAL_OFF_CSV_URL='https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
export const OFFICIAL_OFF_DATA_LICENSE='ODbL';
export const OFFICIAL_OFF_IMAGE_LICENSE='CC-BY-SA';

const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const clean=value=>String(value??'').trim();

const REQUIRED_COLUMNS=['code','product_name'];
const OPTIONAL_COLUMNS=['brands','categories','image_front_url','image_url','quantity','countries','nutriscore_grade','last_modified_datetime'];

export function buildHeaderIndex(headerLine=''){
  const headers=String(headerLine).replace(/\r$/,'').split('\t');
  const index=Object.fromEntries(headers.map((name,i)=>[name,i]));
  const missing=REQUIRED_COLUMNS.filter(name=>!(name in index));
  const optionalMissing=OPTIONAL_COLUMNS.filter(name=>!(name in index));
  return{headers,index,missing,optionalMissing,valid:missing.length===0};
}

export function projectOffTsvLine(line='',headerIndex={}){
  if(!headerIndex?.valid)return null;
  const cells=String(line).replace(/\r$/,'').split('\t');
  const pick=name=>{
    const i=headerIndex.index?.[name];
    return Number.isInteger(i)?clean(cells[i]):'';
  };
  const code=pick('code');
  const product_name=pick('product_name');
  if(!code&&!product_name)return null;
  return{
    code,
    product_name,
    brands:pick('brands'),
    categories:pick('categories'),
    image_front_url:pick('image_front_url'),
    image_url:pick('image_url'),
    quantity:pick('quantity'),
    countries:pick('countries'),
    nutriscore_grade:pick('nutriscore_grade'),
    last_modified_datetime:pick('last_modified_datetime')
  };
}

export function summarizeOfficialOffPilot(input={}){
  const rows=Array.isArray(input.rows)?input.rows:[];
  const minRows=Number.isFinite(Number(input.minRows))?Math.max(1,Number(input.minRows)):10000;
  const identityRows=rows.filter(row=>/^\d{8,14}$/.test(clean(row.code))&&clean(row.product_name));
  const validChecksumIdentityRows=identityRows.filter(row=>isValidGtin(row.code));
  const invalidChecksumIdentityRows=identityRows.length-validChecksumIdentityRows.length;
  const uniqueCodes=new Set(rows.map(row=>clean(row.code)).filter(Boolean));
  const uniqueValidGtins=new Set(validChecksumIdentityRows.map(row=>clean(row.code)));
  const duplicateCodeCount=Math.max(0,rows.filter(row=>clean(row.code)).length-uniqueCodes.size);
  const projectedJson=JSON.stringify(rows);
  const enoughRows=rows.length>=minRows;
  return{
    schema:'MPR_OFFICIAL_OFF_STREAM_PILOT_V2',
    source:{
      sourceKey:'OPEN_FOOD_FACTS',
      url:OFFICIAL_OFF_CSV_URL,
      host:'static.openfoodfacts.org',
      dataLicense:OFFICIAL_OFF_DATA_LICENSE,
      imageLicense:OFFICIAL_OFF_IMAGE_LICENSE,
      sourceClass:'OFFICIAL_BULK_EXPORT'
    },
    metrics:{
      projectedRows:rows.length,
      syntacticIdentityRows:identityRows.length,
      validChecksumIdentityRows:validChecksumIdentityRows.length,
      invalidChecksumIdentityRows,
      uniqueCodeCount:uniqueCodes.size,
      uniqueValidGtinCount:uniqueValidGtins.size,
      duplicateCodeCount,
      syntacticIdentityRate:rows.length?identityRows.length/rows.length:0,
      validChecksumIdentityRate:rows.length?validChecksumIdentityRows.length/rows.length:0
    },
    projectedRowsSha256:sha(projectedJson),
    decision:enoughRows?'PILOT_SAMPLE_ACQUIRED':'HOLD_PILOT_SAMPLE',
    reasons:enoughRows?[]:['MINIMUM_PROJECTED_ROWS_NOT_REACHED'],
    policy:{
      providerDataSpendEur:0,
      paidDataCallsTriggered:0,
      purchaseAuthorized:false,
      verifiedSalesRows:0,
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      commercialUseAuthorized:false
    },
    note:'Open Food Facts bulk data is treated as catalogue bootstrap evidence only. This evidence does not establish verified sales, commercial rights, or production scale readiness.'
  };
}

export function buildDeterministicReviewSample(candidates=[],limit=200){
  const safeLimit=Math.max(0,Math.floor(Number(limit)||0));
  return [...candidates]
    .filter(Boolean)
    .sort((a,b)=>String(a.fingerprint||a.gtin||a.sourceRecordId||'').localeCompare(String(b.fingerprint||b.gtin||b.sourceRecordId||'')))
    .slice(0,safeLimit)
    .map(candidate=>({
      sourceKey:candidate.sourceKey,
      sourceRecordId:candidate.sourceRecordId,
      title:candidate.title,
      brand:candidate.brand,
      category:candidate.category,
      gtin:candidate.gtin,
      gtinValid:candidate.gtin?isValidGtin(candidate.gtin):false,
      identityStrength:candidate.identityStrength,
      evidenceClass:candidate.evidenceClass,
      rankingEligible:candidate.rankingEligible,
      commercialEligible:candidate.commercialEligible,
      salesEvidenceClass:candidate.salesEvidenceClass,
      fingerprint:candidate.fingerprint
    }));
}

export function evaluateOffTenKDryRun({pilot={},ingestion={},reviewSample=[]}={},options={}){
  const minAccepted=Math.max(1,Number(options.minAccepted||10000));
  const minStrongIdentityProducts=Math.max(1,Number(options.minStrongIdentityProducts||10000));
  const minReviewSample=Math.max(1,Number(options.minReviewSample||200));
  const stats=ingestion.stats||{};
  const policy=ingestion.policy||{};
  const reasons=[];
  if(pilot.decision!=='PILOT_SAMPLE_ACQUIRED')reasons.push('OFFICIAL_SAMPLE_NOT_ACQUIRED');
  if(ingestion.decision!=='INGESTION_ACCOUNTED')reasons.push('INGESTION_NOT_ACCOUNTED');
  if(Number(stats.accepted||0)<minAccepted)reasons.push('ACCEPTED_CANDIDATES_BELOW_10K');
  if(Number(stats.strongIdentityProducts||0)<minStrongIdentityProducts)reasons.push('STRONG_IDENTITY_PRODUCTS_BELOW_10K');
  if(Number(stats.silentDrops||0)!==0)reasons.push('SILENT_DROPS_PRESENT');
  if(reviewSample.length<minReviewSample)reasons.push('REVIEW_SAMPLE_TOO_SMALL');
  if(reviewSample.some(x=>x.identityStrength!=='STRONG_GTIN'||x.gtinValid!==true))reasons.push('REVIEW_SAMPLE_NOT_STRONG_IDENTITY_ONLY');
  if(Number(policy.providerDataSpendEur||0)!==0)reasons.push('PROVIDER_SPEND_NONZERO');
  if(Number(policy.paidDataCallsTriggered||0)!==0)reasons.push('PAID_DATA_CALLS_NONZERO');
  if(policy.purchaseAuthorized!==false)reasons.push('PURCHASE_AUTHORIZATION_NOT_FALSE');
  if(policy.salesEvidenceClass!=='NOT_VERIFIED_SALES')reasons.push('SALES_EVIDENCE_CLASS_INVALID');
  const input=Math.max(0,Number(stats.input||0));
  const accepted=Math.max(0,Number(stats.accepted||0));
  const logicalDuplicates=Math.max(0,Number(stats.logicalDuplicates||0));
  const held=Math.max(0,Number(stats.held||0));
  const strongIdentityProducts=Math.max(0,Number(stats.strongIdentityProducts||0));
  const payload={
    schema:'MPR_OFF_TEN_K_DRY_RUN_GATE_V2',
    decision:reasons.length?'HOLD_10K_DRY_RUN':'TEN_K_DRY_RUN_EVIDENCE_READY',
    reasons,
    metrics:{
      input,
      accepted,
      held,
      logicalDuplicates,
      duplicateRate:input?logicalDuplicates/input:0,
      heldRate:input?held/input:0,
      strongIdentityProducts,
      strongIdentityRate:input?strongIdentityProducts/input:0,
      claimCount:Math.max(0,Number(stats.claimCount||0)),
      reviewSampleCount:reviewSample.length
    },
    productionScaleAuthorized:false,
    productionCatalogWriteAuthorized:false,
    commercialUseAuthorized:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,fingerprint:sha(JSON.stringify(payload))};
}

export function assertOfficialOffSource(url=''){
  const parsed=new URL(url);
  const valid=parsed.protocol==='https:'&&parsed.hostname==='static.openfoodfacts.org'&&parsed.pathname==='/data/en.openfoodfacts.org.products.csv.gz';
  if(!valid)throw new Error('OFFICIAL_OFF_SOURCE_REQUIRED');
  return true;
}
