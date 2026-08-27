import crypto from 'node:crypto';

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
  const validIdentityRows=rows.filter(row=>/^\d{8,14}$/.test(clean(row.code))&&clean(row.product_name)).length;
  const uniqueCodes=new Set(rows.map(row=>clean(row.code)).filter(Boolean));
  const duplicateCodeCount=Math.max(0,rows.filter(row=>clean(row.code)).length-uniqueCodes.size);
  const projectedJson=JSON.stringify(rows);
  const enoughRows=rows.length>=minRows;
  return{
    schema:'MPR_OFFICIAL_OFF_STREAM_PILOT_V1',
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
      validIdentityRows,
      uniqueCodeCount:uniqueCodes.size,
      duplicateCodeCount,
      validIdentityRate:rows.length?validIdentityRows/rows.length:0
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
    note:'Open Food Facts bulk data is treated as catalogue bootstrap evidence only. This evidence does not establish verified sales, commercial rights, or scale readiness.'
  };
}

export function assertOfficialOffSource(url=''){
  const parsed=new URL(url);
  const valid=parsed.protocol==='https:'&&parsed.hostname==='static.openfoodfacts.org'&&parsed.pathname==='/data/en.openfoodfacts.org.products.csv.gz';
  if(!valid)throw new Error('OFFICIAL_OFF_SOURCE_REQUIRED');
  return true;
}
