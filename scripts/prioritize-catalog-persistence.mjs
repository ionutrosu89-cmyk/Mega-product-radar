import fs from 'node:fs';
import path from 'node:path';
import {prioritizePersistenceBundle} from '../catalog-prioritization-persistence-v1.js';

const arg=(name,fallback)=>{
  const hit=process.argv.find(x=>x.startsWith(`--${name}=`));
  return hit?hit.slice(name.length+3):fallback;
};

const inputPath=arg('input','artifacts/off-official-stream-pilot-v1/persistence-bundle.json');
const outPath=arg('out','artifacts/catalog-prioritization-v1/top-candidates.json');
const topN=Math.max(0,Math.floor(Number(arg('topN','5000'))||0));

if(!fs.existsSync(inputPath))throw new Error(`PERSISTENCE_BUNDLE_MISSING:${inputPath}`);
const bundle=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const result=prioritizePersistenceBundle(bundle,{topN});

if(result.evidenceClass!=='CATALOG_PRIORITIZATION_ONLY')throw new Error('TRUTH_CLASS_RELAXED');
if(result.policy.salesEvidenceClass!=='NOT_VERIFIED_SALES'||result.policy.verifiedSalesRows!==0)throw new Error('SALES_TRUTH_RELAXED');
if(result.policy.purchaseAuthorized!==false||result.writeAuthorized!==false)throw new Error('AUTHORIZATION_RELAXED');

fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(result,null,2));
console.log(JSON.stringify({input:inputPath,out:outPath,inputCount:result.inputCount,eligibleCount:result.eligibleCount,selectedCount:result.selectedCount,p1Count:result.p1Count,p2Count:result.p2Count,p3Count:result.p3Count,evidenceClass:result.evidenceClass},null,2));
