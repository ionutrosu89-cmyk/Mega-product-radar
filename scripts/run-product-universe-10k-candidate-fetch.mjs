import fs from 'node:fs/promises';
import path from 'node:path';
import {buildUniverseBatch,evaluateUniverseGrowth,PRODUCT_UNIVERSE_TARGET} from '../product-universe-growth-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const out=String(args.out||'artifacts/product-universe-10k-candidates.json');
const currentCanonicalCount=Math.max(0,Number(args.currentCanonicalCount||100));
const target=Math.max(100,Math.min(10000,Number(args.target||PRODUCT_UNIVERSE_TARGET)));
const remoteEnabled=String(process.env.MPR_UNIVERSE_REMOTE_FETCH_ENABLED||'false').toLowerCase()==='true';
const pageSize=Math.max(10,Math.min(100,Number(args.pageSize||100)));
const maxRows=Math.max(pageSize,Math.min(20000,Number(args.maxRows||target*2)));

async function fetchRows(){
  if(!remoteEnabled){
    return[
      {name:'Local fixture A',link:'https://www.amazon.in/dp/B0ABC12345',main_category:'Fixture',sub_category:'Fixture A',ratings:'4.5',no_of_ratings:'100',discount_price:'₹999'},
      {name:'Local fixture B',link:'https://www.amazon.in/dp/B0ABC12346',main_category:'Fixture',sub_category:'Fixture B',ratings:'4.2',no_of_ratings:'80',discount_price:'₹799'},
      {name:'Local duplicate',link:'https://www.amazon.in/dp/B0ABC12345',main_category:'Fixture'}
    ];
  }
  const rows=[];
  for(let offset=0;offset<maxRows&&rows.length<target;offset+=pageSize){
    const url=new URL('https://datasets-server.huggingface.co/rows');
    url.searchParams.set('dataset','ajay-sankey/amazon-products');
    url.searchParams.set('config','default');
    url.searchParams.set('split','train');
    url.searchParams.set('offset',String(offset));
    url.searchParams.set('length',String(pageSize));
    const res=await fetch(url,{headers:{'user-agent':'MegaProductRadar/7 product-universe-analysis'},signal:AbortSignal.timeout(30000)});
    if(!res.ok)throw new Error(`HF_DATASET_HTTP_${res.status}`);
    const payload=await res.json();
    const page=(payload.rows||[]).map(item=>item.row||item);
    if(!page.length)break;
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}

const sourceRows=await fetchRows();
const batch=buildUniverseBatch(sourceRows);
const growth=evaluateUniverseGrowth({currentCanonicalCount,candidateBatchCount:batch.acceptedCount,target:PRODUCT_UNIVERSE_TARGET});
const report={
  schema:'MPR_PRODUCT_UNIVERSE_10K_CANDIDATE_FETCH_V1',
  mode:remoteEnabled?'REMOTE_PUBLIC_DATASET_ANALYSIS':'LOCAL_FIXTURE',
  source:'ajay-sankey/amazon-products',
  sourceRowsFetched:sourceRows.length,
  requestedCandidateTarget:target,
  batch,
  productionBaseline:{canonicalCount:currentCanonicalCount,source:'EXPLICIT_INPUT_OR_KNOWN_BASELINE',countsAsProductionEvidence:false},
  growth,
  policy:{analysisOnly:true,commercialUseAllowed:false,rankingEligible:false,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES'}
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({mode:report.mode,sourceRowsFetched:report.sourceRowsFetched,acceptedCount:batch.acceptedCount,logicalDuplicateCount:batch.logicalDuplicateCount,currentCanonicalCount:growth.currentCanonicalCount,projectedCanonicalCount:growth.projectedCanonicalCount,stageDecision:growth.stageDecision,commercialUseAllowed:false,rankingEligible:false,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false},null,2));
if(growth.stageDecision!=='HOLD_10K_CANONICAL'&&currentCanonicalCount<PRODUCT_UNIVERSE_TARGET)throw new Error('CANDIDATE_FETCH_MUST_NOT_AUTHORIZE_10K');
