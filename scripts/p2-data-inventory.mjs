import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dataDir=path.join(root,'data');
const arg=process.argv.find(x=>x.startsWith('--out='));
const outPath=arg?path.resolve(root,arg.slice(6)):null;

const ADAPTER_BY_SCHEMA=new Map([
  ['MPR_AMAZON_PUBLIC_RANKING_PERSISTED_V1','AMAZON_PUBLIC_RANKING'],
  ['MPR_AMAZON_LEADER_BSR_BASELINE_V1','AMAZON_EXPLICIT_BSR']
]);
const DERIVED_SCHEMA_HINTS=['LEADER','MOVEMENT','VELOCITY','PRELIMINARY','TRIGGER','TARGET','QUEUE','PLAN','REPORT'];

export function classifyDataDocument(doc={},file=''){
  const schemaVersion=String(doc?.schemaVersion||'').trim().toUpperCase();
  if(ADAPTER_BY_SCHEMA.has(schemaVersion))return{classification:'SUPPORTED_RAW_ADAPTER',adapter:ADAPTER_BY_SCHEMA.get(schemaVersion),schemaVersion};
  const rows=doc?.rows||doc?.products||doc?.items||doc?.observations;
  if(Array.isArray(rows)&&rows.some(x=>x&&['price','reviewCount','rating','sourceRank','rank'].some(k=>x[k]!==undefined&&x[k]!==null&&x[k]!=='')))return{classification:'ABSOLUTE_SNAPSHOT_CANDIDATE',adapter:'ABSOLUTE_PRODUCT_SNAPSHOT',schemaVersion:schemaVersion||null};
  if(schemaVersion&&DERIVED_SCHEMA_HINTS.some(h=>schemaVersion.includes(h)))return{classification:'DERIVED_OR_CONTROL_ARTIFACT',adapter:null,schemaVersion};
  return{classification:'UNCLASSIFIED_REQUIRES_REVIEW',adapter:null,schemaVersion:schemaVersion||null,file};
}

export function inventoryDataDirectory(directory=dataDir){
  const files=fs.existsSync(directory)?fs.readdirSync(directory).filter(x=>x.endsWith('.json')).sort():[];
  const records=[],parseErrors=[];
  for(const file of files){
    const full=path.join(directory,file);
    try{
      const doc=JSON.parse(fs.readFileSync(full,'utf8'));
      records.push({file,...classifyDataDocument(doc,file)});
    }catch(error){parseErrors.push({file,error:'JSON_PARSE_FAILED'});}
  }
  const counts=records.reduce((acc,x)=>(acc[x.classification]=(acc[x.classification]||0)+1,acc),{});
  return{schemaVersion:'MPR_P2_DATA_INVENTORY_V1',generatedAt:new Date().toISOString(),dataDirectory:path.relative(root,directory)||'data',totalJsonFiles:files.length,records,parseErrors,counts,policy:'INVENTORY_ONLY; CLASSIFICATION_DOES_NOT_UPGRADE_EVIDENCE; DERIVED_ARTIFACTS_ARE_NOT_RAW_OBSERVATIONS; NO_NETWORK_OR_PAID_CALLS',paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false};
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const report=inventoryDataDirectory();
  const json=JSON.stringify(report,null,2)+'\n';
  if(outPath){fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,json);}else process.stdout.write(json);
}
