import fs from 'node:fs';

const args=new Set(process.argv.slice(2));
const execute=args.has('--execute');
const inputArg=process.argv.find(x=>x.startsWith('--input='));
const batchArg=process.argv.find(x=>x.startsWith('--batch='));
const input=inputArg?.slice('--input='.length)||'data/real-products-1000.compact.json';
const batchSize=Math.max(1,Math.min(250,Number(batchArg?.slice('--batch='.length)||250)));
const approved=process.env.MPR_CANONICAL_BOOTSTRAP_IMPORT_APPROVED==='true';

const dataset=JSON.parse(fs.readFileSync(input,'utf8'));
const fields=dataset.fields||[];
const ix=Object.fromEntries(fields.map((name,i)=>[name,i]));
const rows=(dataset.products||[]).map(row=>({
  platform:'AMAZON',
  externalId:String(row[ix.asin]??'').trim(),
  title:String(row[ix.title]??'').trim()||null,
  brand:String(row[ix.brand]??'').trim()||null,
  categoryLabel:String(row[ix.categoryLabel]??'').trim()||null,
  market:'US'
})).filter(x=>x.externalId);

const duplicateCount=rows.length-new Set(rows.map(x=>x.externalId)).size;
const plan={schemaVersion:'MPR_CANONICAL_BOOTSTRAP_IMPORT_PLAN_V1',input,sourceSchemaVersion:dataset.schemaVersion||null,sourceDigest:dataset.productSetSha256||null,rowCount:rows.length,duplicateCount,batchSize,executeRequested:execute,approvalFlag:approved,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false};
console.log(JSON.stringify(plan,null,2));

if(!execute){
  console.log('DRY_RUN_ONLY: pass --execute and set MPR_CANONICAL_BOOTSTRAP_IMPORT_APPROVED=true to write canonical identities.');
  process.exit(0);
}
if(!approved)throw new Error('CANONICAL_BOOTSTRAP_IMPORT_NOT_APPROVED');
if(duplicateCount!==0)throw new Error('DUPLICATE_EXTERNAL_IDS_IN_BOOTSTRAP');

const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
if(!url||!key)throw new Error('SUPABASE_SERVICE_CONFIGURATION_REQUIRED');

let resolved=0,created=0,rejected=0;
for(let i=0;i<rows.length;i+=batchSize){
  const batch=rows.slice(i,i+batchSize);
  const res=await fetch(`${url}/rest/v1/rpc/resolve_canonical_bootstrap_batch_v1`,{
    method:'POST',
    headers:{'content-type':'application/json','apikey':key,'authorization':`Bearer ${key}`},
    body:JSON.stringify({p_rows:batch,p_source_digest:dataset.productSetSha256||null})
  });
  if(!res.ok)throw new Error(`CANONICAL_BOOTSTRAP_BATCH_FAILED_${res.status}:${await res.text()}`);
  const result=await res.json();
  resolved+=Number(result.resolvedCount)||0;
  created+=Number(result.createdCanonicalCount)||0;
  rejected+=Number(result.rejectedCount)||0;
  console.log(JSON.stringify({batchStart:i,batchCount:batch.length,resolved:result.resolvedCount,created:result.createdCanonicalCount,rejected:result.rejectedCount}));
}

const summary={schemaVersion:'MPR_CANONICAL_BOOTSTRAP_IMPORT_RESULT_V1',sourceDigest:dataset.productSetSha256||null,inputCount:rows.length,resolvedCount:resolved,createdCanonicalCount:created,rejectedCount:rejected,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false};
console.log(JSON.stringify(summary,null,2));
if(rejected>0)process.exitCode=2;
