import fs from 'node:fs/promises';
import path from 'node:path';
import {extractAlibabaProductCandidates} from '../alibaba-candidate-discovery-v1.js';
import {parseFocusedSupplierDetailHtml,FocusedSupplierEvidenceTruthPolicy} from '../focused-supplier-evidence-v1.js';

const outPath=process.argv[2]||'artifacts/focused-supplier-evidence-discovery.json';
const queries=[
  'mesh desk organizer file holder 5 tier drawer 2 pen holders',
  '5 tier paper tray organizer drawer 2 pen holders',
  '5 tier desk organizer drawer two pen holders black'
];
const fallbackDiscoveryPages=[
  'https://www.alibaba.com/countrysearch/CN/office-desk-organizer.html',
  'https://www.alibaba.com/wholesale/mesh-desk-organizer-sliding-drawer.html',
  'https://www.alibaba.com/wholesale/desk-organizer-file-holder.html',
  'https://www.alibaba.com/category/Pen-Holders_211114.html'
];
const headers={
  'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function get(url){
  try{
    const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(20000)});
    const text=await r.text();
    const blocked=/captcha|security verification|verify.*human|punish|risk.*control|access denied/i.test(text);
    return {ok:r.ok&&!blocked,statusCode:r.status,blocked,htmlBytes:text.length,text,error:null,finalUrl:r.url};
  }catch(error){return {ok:false,statusCode:null,blocked:false,htmlBytes:0,text:'',error:String(error?.message||error),finalUrl:url};}
}

const diagnostics=[];
const candidates=new Map();
const addCandidates=(rows,discoveryKind)=>{
  for(const row of rows)if(!candidates.has(row.url))candidates.set(row.url,{...row,discoveryKind});
};
for(const query of queries){
  const searchUrl=`https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`;
  const r=await get(searchUrl);
  const rows=r.ok?extractAlibabaProductCandidates(r.text,{query,sourceUrl:searchUrl,limit:12}):[];
  addCandidates(rows,'TRADE_SEARCH');
  diagnostics.push({kind:'SEARCH',query,url:searchUrl,httpOk:r.ok,statusCode:r.statusCode,blocked:r.blocked,htmlBytes:r.htmlBytes,candidates:rows.length,error:r.error});
  await sleep(300);
}
for(const pageUrl of fallbackDiscoveryPages){
  const r=await get(pageUrl);
  const rows=r.ok?extractAlibabaProductCandidates(r.text,{query:'focused-static-fallback',sourceUrl:pageUrl,limit:20}):[];
  addCandidates(rows,'STATIC_INDEX_PAGE');
  diagnostics.push({kind:'STATIC_DISCOVERY',url:pageUrl,httpOk:r.ok,statusCode:r.statusCode,blocked:r.blocked,htmlBytes:r.htmlBytes,candidates:rows.length,error:r.error});
  await sleep(300);
}

const details=[];
for(const candidate of [...candidates.values()].slice(0,30)){
  const r=await get(candidate.url);
  const parsed=r.ok?parseFocusedSupplierDetailHtml(r.text,{url:candidate.url,externalId:candidate.externalId}):null;
  details.push({
    ...candidate,fetch:{httpOk:r.ok,statusCode:r.statusCode,blocked:r.blocked,htmlBytes:r.htmlBytes,error:r.error,finalUrl:r.finalUrl},
    evidence:parsed
  });
  diagnostics.push({kind:'DETAIL',externalId:candidate.externalId,url:candidate.url,httpOk:r.ok,statusCode:r.statusCode,blocked:r.blocked,htmlBytes:r.htmlBytes,error:r.error});
  await sleep(300);
}

details.sort((a,b)=>(b.evidence?.evidenceScore??-1)-(a.evidence?.evidenceScore??-1));
const exactConfig=details.filter(x=>x.evidence?.distinctiveConfigConfirmed);
const withDirectDimensions=exactConfig.filter(x=>x.evidence?.dimensions);
const screeningCandidates=details.filter(x=>x.evidence?.screeningCandidate);
const output={
  schemaVersion:'MPR_FOCUSED_SUPPLIER_EVIDENCE_DISCOVERY_V1',generatedAt:new Date().toISOString(),
  target:{marketplace:'AMAZON_US',amazonAsin:'B09K5927B5',requiredConfiguration:['5-tier','drawer','2-pen-holders','desk-or-paper-organizer']},
  queries,fallbackDiscoveryPages,searchesAttempted:queries.length,staticPagesAttempted:fallbackDiscoveryPages.length,
  uniqueCandidateUrls:candidates.size,detailsAttempted:details.length,
  exactConfigurationCount:exactConfig.length,directDimensionsCount:withDirectDimensions.length,screeningCandidateCount:screeningCandidates.length,
  screeningCandidates,details,diagnostics,
  policy:{...FocusedSupplierEvidenceTruthPolicy,providerSpendUsd:0,paidCallsTriggered:0,credentialsUsed:false,negotiationIncluded:false,purchaseAuthorized:false}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({
  schemaVersion:output.schemaVersion,uniqueCandidateUrls:output.uniqueCandidateUrls,detailsAttempted:output.detailsAttempted,
  exactConfigurationCount:output.exactConfigurationCount,directDimensionsCount:output.directDimensionsCount,
  screeningCandidateCount:output.screeningCandidateCount,
  discoveryDiagnostics:diagnostics.filter(x=>x.kind!=='DETAIL').map(x=>({kind:x.kind,url:x.url,candidates:x.candidates,httpOk:x.httpOk,blocked:x.blocked,htmlBytes:x.htmlBytes})),
  top:details.slice(0,5).map(x=>({externalId:x.externalId,title:x.evidence?.title??null,evidenceScore:x.evidence?.evidenceScore??null,distinctiveConfigConfirmed:x.evidence?.distinctiveConfigConfirmed??false,dimensions:x.evidence?.dimensions??null,priceCandidate:x.evidence?.priceCandidate??null,moqCandidate:x.evidence?.moqCandidate??null,blocked:x.fetch?.blocked??false,discoveryKind:x.discoveryKind}))
},null,2));
