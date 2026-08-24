import fs from 'node:fs/promises';
import path from 'node:path';

const USER_APPROVAL='USER_APPROVED_1000_REAL_PRODUCTS_2026_08_24';
const observedAt=new Date().toISOString();

const sourceSeeds=[
  ['office:cable-management','cable management'],
  ['office:desk-organization','desk organizer'],
  ['office:laptop-accessories','laptop stand'],
  ['office:headphone-accessories','headphone stand'],
  ['phone-tech:phone-holders','phone holder'],
  ['phone-tech:tablet-stands','tablet stand'],
  ['phone-tech:charging-organization','charging station organizer'],
  ['phone-tech:tech-travel-organization','electronics travel organizer'],
  ['home-organization:space-saving-storage','space saving storage organizer'],
  ['home-organization:drawer-organization','drawer organizer'],
  ['home-organization:closet-organization','closet organizer'],
  ['home-organization:entryway-organization','entryway organizer'],
  ['kitchen:kitchen-organization','kitchen organizer'],
  ['kitchen:pantry-storage','pantry organizer'],
  ['kitchen:sink-organization','sink organizer'],
  ['kitchen:food-prep-tools','food prep tools'],
  ['bathroom:no-drill-storage','no drill bathroom shelf'],
  ['bathroom:shower-organization','shower caddy'],
  ['bathroom:sink-organization','bathroom sink organizer'],
  ['bathroom:toiletry-storage','toiletry organizer'],
  ['cleaning-laundry:laundry-organization','laundry organizer'],
  ['cleaning-laundry:cleaning-storage','cleaning supplies organizer'],
  ['car-interior:visor-accessories','car visor organizer'],
  ['car-interior:seat-organization','car seat organizer'],
  ['car-interior:cup-holder-accessories','car cup holder organizer'],
  ['car-interior:car-storage','car storage organizer'],
  ['car-travel:headrest-accessories','car headrest accessories'],
  ['car-travel:trunk-organization','trunk organizer'],
  ['baby:stroller-accessories','stroller organizer'],
  ['baby:nursery-organization','nursery organizer'],
  ['baby:baby-travel','baby travel organizer'],
  ['kids:kids-room-organization','kids room organizer'],
  ['toys-education:montessori','montessori toys'],
  ['toys-education:fine-motor','fine motor toys'],
  ['dog:dog-travel','dog travel bag'],
  ['dog:feeding-organization','dog feeding station organizer'],
  ['dog:walking-accessories','dog walking accessories'],
  ['cat:cat-home','cat home accessories'],
  ['cat:litter-organization','cat litter organizer'],
  ['cat:travel-accessories','cat carrier'],
  ['packing:packing-cubes','packing cubes'],
  ['packing:toiletry-organization','toiletry bag organizer'],
  ['packing:document-organization','travel document organizer'],
  ['packing:luggage-accessories','luggage organizer'],
  ['travel-comfort:airplane-accessories','airplane travel accessories'],
  ['travel-comfort:sleep-comfort','travel pillow'],
  ['travel-comfort:portable-organization','portable travel organizer'],
  ['beauty:makeup-organization','makeup organizer'],
  ['beauty:hair-tool-organization','hair tool organizer'],
  ['beauty:cosmetic-travel','cosmetic travel organizer'],
  ['fashion-accessories:jewelry-organization','jewelry organizer'],
  ['fashion-accessories:shoe-accessories','shoe organizer'],
  ['fashion-accessories:hat-storage','hat organizer'],
  ['fitness:home-fitness-accessories','home fitness accessories'],
  ['fitness:resistance-training','resistance bands'],
  ['fitness:recovery-accessories','fitness recovery accessories'],
  ['fitness:fitness-organization','gym organizer'],
  ['sports:sports-organization','sports equipment organizer'],
  ['outdoor:camping-organization','camping organizer'],
  ['outdoor:hiking-accessories','hiking accessories'],
  ['outdoor:picnic-accessories','picnic bag'],
  ['garden:plant-support','plant support'],
  ['garden:plant-care','plant care tools'],
  ['garden:balcony-organization','balcony organizer'],
  ['diy:tool-organization','tool organizer'],
  ['diy:drill-free-mounting','no drill shelf'],
  ['diy:small-repair-accessories','small repair tools'],
  ['party:reusable-decor','reusable party decorations'],
  ['party:party-organization','party organizer'],
  ['party:birthday-accessories','birthday decorations'],
  ['hobby-craft:craft-organization','craft organizer'],
  ['hobby-craft:painting-accessories','painting accessories'],
  ['seasonal:holiday-organization','holiday storage organizer'],
  ['seasonal:summer-accessories','summer accessories'],
  ['gifts:small-useful-gifts','useful gifts'],
  ['gifts:desk-gifts','desk gifts'],
  ['senior-comfort:home-convenience','home convenience products']
];

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const target=Math.max(1000,Math.min(5000,Number(args.target)||1200));
const out=String(args.out||'artifacts/real-public-seed-1000.json');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const decode=s=>String(s||'')
  .replace(/\\u002F/gi,'/').replace(/\\u0026/gi,'&').replace(/\\\//g,'/')
  .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#34;/g,'"').replace(/&#x2F;/gi,'/');
const stripTags=s=>decode(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();

function alibabaUrl(raw){
  let u=decode(raw).trim();if(u.startsWith('//'))u='https:'+u;
  if(!/^https:\/\//i.test(u))return null;
  try{const x=new URL(u);if(!/(^|\.)alibaba\.com$/i.test(x.hostname)||!/\/product-detail\//i.test(x.pathname))return null;x.protocol='https:';x.hash='';x.search='';return x.toString();}catch{return null;}
}
function ebayUrl(raw){
  let u=decode(raw).trim();if(u.startsWith('//'))u='https:'+u;
  if(!/^https:\/\//i.test(u))return null;
  try{const x=new URL(u);if(!/(^|\.)ebay\.com$/i.test(x.hostname)||!/^\/itm\//i.test(x.pathname))return null;x.protocol='https:';x.hostname='www.ebay.com';x.hash='';x.search='';return x.toString();}catch{return null;}
}
function alibabaId(url){return String(url).match(/_(\d{8,})\.html(?:$|[?#])/i)?.[1]||String(url).match(/\/(\d{8,})\.html(?:$|[?#])/i)?.[1]||null;}
function ebayId(url){return String(url).match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:\/|$)/i)?.[1]||null;}
function titleFromUrl(url,fallback){
  try{let p=decodeURIComponent(new URL(url).pathname);let bits=p.split('/').filter(Boolean);let base=bits.at(-1)||'';if(/^\d+$/.test(base)&&bits.length>2)base=bits.at(-2)||'';base=base.replace(/\.html$/i,'').replace(/_\d{8,}$/,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();return base||fallback;}catch{return fallback;}
}

function extractAlibaba(html,meta){
  const body=decode(html),found=[];let m;
  const rx=/href\s*=\s*["']([^"']*\/product-detail\/[^"']+)["']/gi;
  while((m=rx.exec(body)))found.push({url:alibabaUrl(m[1]),at:m.index});
  const by=new Map();for(const x of found)if(x.url&&!by.has(x.url))by.set(x.url,x.at);
  const rows=[];let position=0;
  for(const [url,at] of by){position++;const around=body.slice(Math.max(0,at-1200),Math.min(body.length,at+1600));const attr=[...around.matchAll(/(?:title|alt)\s*=\s*["']([^"']{8,240})["']/gi)].map(x=>stripTags(x[1])).filter(Boolean).sort((a,b)=>b.length-a.length)[0]||null;const id=alibabaId(url);rows.push({sourceKey:'ALIBABA_PUBLIC_SHOWROOM',platform:'ALIBABA',surface:'CATALOGUE_DISCOVERY',externalId:id,url,title:attr||titleFromUrl(url,'Alibaba product'),categoryLabel:meta.mprCategory,sourceCategoryId:meta.query,sourcePosition:position,sourceRank:null,observedAt,evidenceClass:'CATALOGUE_DISCOVERY_OBSERVATION',identityEvidence:id?'ALIBABA_NATIVE_PRODUCT_ID_FROM_URL':'REAL_PRODUCT_URL',titleEvidence:attr?'PUBLIC_HTML_NEAR_PRODUCT_LINK':'URL_SLUG_DERIVED',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,provenance:{sourcePage:meta.pageUrl,userApproval:USER_APPROVAL,providerCostEur:0}});}
  return rows;
}

function extractEbay(html,meta){
  const body=decode(html),by=new Map();let m;
  const anchorRx=/<a\b[^>]*href\s*=\s*["']([^"']*\/itm\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while((m=anchorRx.exec(body))){const url=ebayUrl(m[1]);if(!url)continue;const title=stripTags(m[2]).replace(/^Opens in a new window or tab\s*/i,'').trim();if(!by.has(url))by.set(url,{at:m.index,title:title.length>=4?title:null});}
  const urlRx=/(?:https?:)?\/\/www\.ebay\.com\/itm\/[^"'<>\s]+/gi;
  while((m=urlRx.exec(body))){const url=ebayUrl(m[0]);if(url&&!by.has(url))by.set(url,{at:m.index,title:null});}
  const rows=[];let position=0;
  for(const [url,info] of by){position++;const id=ebayId(url);const around=body.slice(Math.max(0,info.at-900),Math.min(body.length,info.at+1500));const attr=[...around.matchAll(/(?:title|aria-label|alt)\s*=\s*["']([^"']{8,260})["']/gi)].map(x=>stripTags(x[1])).filter(x=>!/^image/i.test(x)).sort((a,b)=>b.length-a.length)[0]||null;const title=info.title||attr||titleFromUrl(url,'eBay product');rows.push({sourceKey:'EBAY_PUBLIC_CATALOG_SEARCH',platform:'EBAY',surface:'CATALOGUE_DISCOVERY',externalId:id,url,title,categoryLabel:meta.mprCategory,sourceCategoryId:meta.query,sourcePosition:position,sourceRank:null,observedAt,evidenceClass:'CATALOGUE_DISCOVERY_OBSERVATION',identityEvidence:id?'EBAY_NATIVE_ITEM_ID_FROM_URL':'REAL_PRODUCT_URL',titleEvidence:info.title?'PUBLIC_ITEM_ANCHOR_TEXT':attr?'PUBLIC_HTML_NEAR_ITEM_LINK':'URL_SLUG_DERIVED',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,provenance:{sourcePage:meta.pageUrl,userApproval:USER_APPROVAL,providerCostEur:0,searchSort:'BEST_MATCH_NOT_RANKING'}});}
  return rows;
}

async function fetchPage(url){
  const headers={'user-agent':'Mozilla/5.0 (compatible; MegaProductRadar/1.0; public-market-research)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  let last;
  for(let attempt=1;attempt<=2;attempt++){
    try{const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(18000)});if(!r.ok)throw new Error(`HTTP_${r.status}`);const text=await r.text();if(text.length<1000)throw new Error('HTML_TOO_SMALL');return{text,status:r.status};}catch(e){last=e;if(attempt<2)await sleep(700);}
  }
  throw last;
}

const observations=[],sourceDiagnostics=[],globalIdentity=new Set();
function addRows(rows){let added=0;for(const row of rows){if(observations.length>=target)break;const key=row.platform+':'+(row.externalId||row.url);if(globalIdentity.has(key))continue;globalIdentity.add(key);observations.push(row);added++;}return added;}

// Alibaba remains attempted first because it is a sourcing-side public source. Some server environments return shell-only HTML; zero extraction is allowed and never fabricated.
for(const [mprCategory,query] of sourceSeeds.slice(0,12)){
  if(observations.length>=target)break;
  const slug=query.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const pageUrl=`https://www.alibaba.com/showroom/${encodeURIComponent(slug)}.html`;
  try{const {text}=await fetchPage(pageUrl);const rows=extractAlibaba(text,{mprCategory,query,pageUrl});sourceDiagnostics.push({platform:'ALIBABA',mprCategory,query,pageUrl,status:'OK',extracted:rows.length,uniqueAdded:addRows(rows)});}catch(e){sourceDiagnostics.push({platform:'ALIBABA',mprCategory,query,pageUrl,status:'FAILED',error:String(e?.message||e),extracted:0,uniqueAdded:0});}
  await sleep(200);
}

// eBay public search is used only for catalogue discovery, never BEST_SELLING/ranking semantics.
for(const [mprCategory,query] of sourceSeeds){
  if(observations.length>=target)break;
  const pageUrl=`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_ipg=240`;
  try{const {text}=await fetchPage(pageUrl);const rows=extractEbay(text,{mprCategory,query,pageUrl});sourceDiagnostics.push({platform:'EBAY',mprCategory,query,pageUrl,status:'OK',extracted:rows.length,uniqueAdded:addRows(rows)});}catch(e){sourceDiagnostics.push({platform:'EBAY',mprCategory,query,pageUrl,status:'FAILED',error:String(e?.message||e),extracted:0,uniqueAdded:0});}
  await sleep(250);
}

const byPlatform={};for(const x of observations)byPlatform[x.platform]=(byPlatform[x.platform]||0)+1;
const payload={schemaVersion:'REAL_PUBLIC_SEED_1000_V2',generatedAt:observedAt,userApproval:USER_APPROVAL,target,uniqueProductCount:observations.length,byPlatform,sourcePagesAttempted:sourceDiagnostics.length,sourcePagesSucceeded:sourceDiagnostics.filter(x=>x.status==='OK').length,sourcePagesFailed:sourceDiagnostics.filter(x=>x.status!=='OK').length,sourceDiagnostics,observations,policy:{paidCallsTriggered:0,providerSpendEur:0,externalExecutionTriggered:true,executionReason:'EXPLICIT_USER_APPROVAL_TO_REACH_1000_REAL_PRODUCTS',salesEvidenceClass:'NOT_VERIFIED_SALES',catalogueDiscoveryIsNotRanking:true,crossPlatformAutoMerge:false,purchaseAuthorized:false}};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({out,uniqueProductCount:payload.uniqueProductCount,byPlatform,succeeded:payload.sourcePagesSucceeded,failed:payload.sourcePagesFailed,target},null,2));
if(payload.uniqueProductCount<1000){console.error(`REAL_PRODUCT_TARGET_NOT_REACHED ${payload.uniqueProductCount}/1000`);process.exitCode=2;}
