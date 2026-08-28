import fs from 'node:fs/promises';
import {evaluateOffProductionLoadEvidence,parseContentRangeTotal} from '../off-production-load-evidence-v1.js';

const supabaseUrl=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const serviceRoleKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const out=String(process.env.MPR_OFF_PRODUCTION_EVIDENCE_OUT||'artifacts/off-10k-production-load/production-evidence.json');
const target=Math.max(1,Number(process.env.MPR_OFF_WRITE_TARGET||10000));
if(!supabaseUrl||!serviceRoleKey)throw new Error('SUPABASE_EVIDENCE_CONFIGURATION_REQUIRED');

async function exactCount(table,filters={}){
  const url=new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set('select','*');
  for(const [key,value] of Object.entries(filters))url.searchParams.set(key,value);
  const response=await fetch(url,{method:'HEAD',headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`,prefer:'count=exact',range:'0-0','range-unit':'items'}});
  if(!response.ok)throw new Error(`SUPABASE_COUNT_FAILED:${table}:${response.status}`);
  const total=parseContentRangeTotal(response.headers.get('content-range'));
  if(total===null)throw new Error(`SUPABASE_COUNT_MISSING:${table}`);
  return total;
}

const counts={
  canonicalGtinProducts:await exactCount('canonical_products',{canonical_key:'like.GTIN:*'}),
  offGtinIdentities:await exactCount('product_identity_keys_v2',{namespace:'eq.GTIN',source_key:'eq.OPEN_FOOD_FACTS'}),
  offSourceRecords:await exactCount('catalog_source_records_v1',{source_key:'eq.OPEN_FOOD_FACTS'}),
  offClaims:await exactCount('product_claims_v1',{source_key:'eq.OPEN_FOOD_FACTS'})
};
const evidence=evaluateOffProductionLoadEvidence({target,...counts});
await fs.mkdir(out.split('/').slice(0,-1).join('/')||'.',{recursive:true});
await fs.writeFile(out,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
if(evidence.decision!=='TEN_K_PRODUCTION_LOAD_VERIFIED')process.exit(2);
