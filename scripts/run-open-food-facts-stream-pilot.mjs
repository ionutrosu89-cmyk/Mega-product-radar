import {mkdir,writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {adaptOpenFactsRecord} from '../catalog-source-adapters-v1.js';
import {runBulkCatalogIngestion} from '../bulk-catalog-ingestion-v1.js';
import {buildCatalogPersistenceBundle} from '../catalog-persistence-v1.js';
import {
  OFFICIAL_OFF_CSV_URL,
  assertOfficialOffSource,
  buildHeaderIndex,
  projectOffTsvLine,
  summarizeOfficialOffPilot,
  buildDeterministicReviewSample,
  evaluateOffTenKDryRun
} from '../open-food-facts-stream-pilot-v1.js';

const enabled=String(process.env.MPR_OFF_STREAM_FETCH_ENABLED||'false').toLowerCase()==='true';
const maxRows=Math.max(1,Number(process.env.MPR_OFF_STREAM_MAX_ROWS||24000));
const minRows=Math.max(1,Number(process.env.MPR_OFF_STREAM_MIN_ROWS||20000));
const minAccepted=Math.max(1,Number(process.env.MPR_OFF_STREAM_MIN_ACCEPTED||10000));
const reviewSampleSize=Math.max(1,Number(process.env.MPR_OFF_STREAM_REVIEW_SAMPLE||200));
const outDir=process.env.MPR_OFF_STREAM_OUT_DIR||'artifacts/off-official-stream-pilot-v1';

async function fetchRows(){
  assertOfficialOffSource(OFFICIAL_OFF_CSV_URL);
  const response=await fetch(OFFICIAL_OFF_CSV_URL,{headers:{'user-agent':'MegaProductRadar/7.0 catalog-bootstrap-pilot'}});
  if(!response.ok||!response.body)throw new Error(`OFF_STREAM_HTTP_${response.status}`);
  const source=Readable.fromWeb(response.body);
  const gunzip=createGunzip();
  source.pipe(gunzip);
  const rl=createInterface({input:gunzip,crlfDelay:Infinity});
  let header=null;
  const rows=[];
  try{
    for await(const line of rl){
      if(!header){
        header=buildHeaderIndex(line);
        if(!header.valid)throw new Error(`OFF_STREAM_MISSING_COLUMNS:${header.missing.join(',')}`);
        continue;
      }
      const row=projectOffTsvLine(line,header);
      if(row)rows.push(row);
      if(rows.length>=maxRows)break;
    }
  }finally{
    rl.close();
    source.unpipe(gunzip);
    gunzip.destroy();
    source.destroy();
  }
  return rows;
}

function fixtureRows(){
  return [
    {code:'4006381333931',product_name:'Fixture Alpha',brands:'Fixture',categories:'Food',quantity:'1',countries:'Romania',nutriscore_grade:'a',last_modified_datetime:'2026-08-27T00:00:00Z'},
    {code:'5901234123457',product_name:'Fixture Beta',brands:'Fixture',categories:'Food',quantity:'1',countries:'Romania',nutriscore_grade:'b',last_modified_datetime:'2026-08-27T00:00:00Z'}
  ];
}

const rows=enabled?await fetchRows():fixtureRows();
const pilot=summarizeOfficialOffPilot({rows,minRows});
const retrievedAt=new Date().toISOString();
const ingestion=runBulkCatalogIngestion({sourceKey:'OPEN_FOOD_FACTS',records:rows,retrievedAt},{adapter:adaptOpenFactsRecord});
const persistence=buildCatalogPersistenceBundle(ingestion);
const reviewSample=buildDeterministicReviewSample(ingestion.accepted,reviewSampleSize);
const dryRun=evaluateOffTenKDryRun({pilot,ingestion,reviewSample},{minAccepted,minReviewSample:reviewSampleSize});
const tenKCandidateSet=dryRun.decision==='TEN_K_DRY_RUN_EVIDENCE_READY';

const report={
  schema:'MPR_OFFICIAL_OFF_STREAM_PILOT_RUN_V2',
  mode:enabled?'OFFICIAL_REMOTE_STREAM':'LOCAL_FIXTURE_ONLY',
  sourceUrl:OFFICIAL_OFF_CSV_URL,
  remoteFetchEnabled:enabled,
  productionCatalogWritePerformed:false,
  productionScaleAuthorized:false,
  pilot,
  ingestionStats:ingestion.stats,
  ingestionDecision:ingestion.decision,
  persistenceBundleSha256:persistence.bundleSha256,
  persistenceCounts:persistence.counts,
  reviewSampleCount:reviewSample.length,
  dryRun,
  tenKCandidateSet,
  tenKCandidateDecision:tenKCandidateSet?'TEN_K_DRY_RUN_CANDIDATES_READY':'HOLD_10K_CANDIDATES',
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES',commercialUseAuthorized:false},
  note:enabled?'Official Open Food Facts bulk export was streamed and truncated after the configured projected-row limit. This is a dry-run evidence set only; no database write or production scale authorization occurred.':'Remote fetch is disabled by default; local fixture evidence cannot establish a real catalog milestone.'
};

if(report.policy.purchaseAuthorized||report.policy.providerDataSpendEur!==0||report.policy.paidDataCallsTriggered!==0)throw new Error('POLICY_INVARIANT_VIOLATION');
if(report.productionCatalogWritePerformed||report.productionScaleAuthorized)throw new Error('OFF_DRY_RUN_MUST_NOT_AUTHORIZE_PRODUCTION');
if(!enabled&&tenKCandidateSet)throw new Error('LOCAL_FIXTURE_MUST_NOT_SATISFY_10K_DRY_RUN');

await mkdir(outDir,{recursive:true});
await writeFile(`${outDir}/summary.json`,JSON.stringify(report,null,2));
await writeFile(`${outDir}/persistence-bundle.json`,JSON.stringify(persistence));
await writeFile(`${outDir}/review-sample.json`,JSON.stringify({schema:'MPR_OFF_REVIEW_SAMPLE_V1',count:reviewSample.length,candidates:reviewSample},null,2));
console.log(JSON.stringify(report,null,2));
