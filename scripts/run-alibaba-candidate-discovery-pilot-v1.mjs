import fs from 'node:fs/promises';
import path from 'node:path';
import {extractAlibabaProductCandidates,AlibabaCandidateDiscoveryTruthPolicy} from '../alibaba-candidate-discovery-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...r]=x.replace(/^--/,'').split('=');return[k,r.join('=')||true];}));
const out=String(args.out||'artifacts/alibaba-candidate-discovery-pilot-v1.json');
const maxPerQuery=Math.max(1,Math.min(30,Number(args.maxPerQuery)||10));
const queries=['desk organizer','car seat organizer','stroller organizer','packing cubes','oversized beach towel','white noise machine','camera bag','knee brace','wrist support','car back seat protector'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ua='Mozilla/5.0 (compatible; MegaProductRadar/2.0; supplier-candidate-research)';

async function fetchSearch(query){
  const url=`https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`;
  try{
    const r=await fetch(url,{headers:{'user-agent':ua,'accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(20000)});
    const text=await r.text();
    return {query,url,statusCode:r.status,httpOk:r.ok,htmlBytes:text.length,text,error:null};
  }catch(error){return {query,url,statusCode:null,httpOk:false,htmlBytes:0,text:'',error:String(error?.message||error)};}
}

const observedAt=new Date().toISOString();
const byUrl=new Map();
const diagnostics=[];
for(const query of queries){
  const page=await fetchSearch(query);
  const rows=page.httpOk?extractAlibabaProductCandidates(page.text,{query,sourceUrl:page.url,limit:maxPerQuery}):[];
  for(const row of rows)if(!byUrl.has(row.url))byUrl.set(row.url,row);
  diagnostics.push({query:page.query,searchUrl:page.url,statusCode:page.statusCode,httpOk:page.httpOk,htmlBytes:page.htmlBytes,candidatesExtracted:rows.length,error:page.error});
  await sleep(300);
}
const observations=[...byUrl.values()];
const output={schemaVersion:'MPR_ALIBABA_SUPPLIER_CANDIDATE_DISCOVERY_V1',generatedAt:observedAt,queriesPlanned:queries.length,queriesAttempted:diagnostics.length,uniqueCandidateUrls:observations.length,observations,diagnostics,policy:{...AlibabaCandidateDiscoveryTruthPolicy,paidCallsTriggered:0,providerSpend:0,negotiationIncluded:false,purchaseAuthorized:false}};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out,queriesAttempted:output.queriesAttempted,uniqueCandidateUrls:output.uniqueCandidateUrls,httpOkQueries:diagnostics.filter(x=>x.httpOk).length},null,2));
