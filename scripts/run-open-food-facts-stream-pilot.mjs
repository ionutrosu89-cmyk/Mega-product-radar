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
  summarizeOfficialOffPilot
} from '../open-food-facts-stream-pilot-v1.js';

const enabled=String(process.env.MPR_OFF_STREAM_FETCH_ENABLED||'false').toLowerCase()==='true';
const maxRows=Math.max(1,Number(process.env.MPR_OFF_STREAM_MAX_ROWS||12000));
const minRows=Math.max(1,Number(process.env.MPR_OFF_STREAM_MIN_ROWS||10000));
const outDir=process.env.MPR_OFF_STREAM_OUT_DIR||'artifacts/off-official-stream-pilot-v1';

async function fetchRows(){
  assertOfficialOffSource(OFFICIAL_OFF_CSV_URL);
  const controller=new AbortController();
  const response=await fetch(OFFICIAL_OFF_CSV_URL,{signal:controller.signal,headers:{'user-agent':'MegaProductRadar/7.0 catalog-bootstrap-pilot'}});
  if(!response.ok||!response.body)throw new Error(`OFF_STREAM_HTTP_${response.status}`);
  const gunzip=createGunzip();
  Readable.fromWeb(response.body).pipe(gunzip);
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
    gunzip.destroy();
    controller.abort();
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
const tenKCandidateSet=ingestion.stats.accepted>=10000;

const report={
  schema:'MPR_OFFICIAL_OFF_STREAM_PILOT_RUN_V1',
  mode:enabled?'OFFICIAL_REMOTE_STREAM':'LOCAL_FIXTURE_ONLY',
  sourceUrl:OFFICIAL_OFF_CSV_URL,
  remoteFetchEnabled:enabled,
  productionCatalogWritePerformed:false,
  pilot,
  ingestionStats:ingestion.stats,
  ingestionDecision:ingestion.decision,
  persistenceBundleSha256:persistence.bundleSha256,
  persistenceCounts:persistence.counts,
  tenKCandidateSet,
  tenKCandidateDecision:tenKCandidateSet?'TEN_K_CANDIDATE_SET':'HOLD_10K_CANDIDATES',
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES'},
  note:enabled?'Official Open Food Facts bulk export was streamed and truncated after the configured projected-row limit; no database write occurred.':'Remote fetch is disabled by default; local fixture evidence cannot establish a real catalog milestone.'
};

if(report.policy.purchaseAuthorized||report.policy.providerDataSpendEur!==0||report.policy.paidDataCallsTriggered!==0)throw new Error('POLICY_INVARIANT_VIOLATION');
if(!enabled&&report.productionCatalogWritePerformed)throw new Error('LOCAL_FIXTURE_WRITE_FORBIDDEN');

await mkdir(outDir,{recursive:true});
await writeFile(`${outDir}/summary.json`,JSON.stringify(report,null,2));
await writeFile(`${outDir}/persistence-bundle.json`,JSON.stringify(persistence));
console.log(JSON.stringify(report,null,2));
