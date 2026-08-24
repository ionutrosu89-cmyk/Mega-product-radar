import fs from 'node:fs/promises';
import path from 'node:path';

const USER_APPROVAL='USER_APPROVED_1000_REAL_PRODUCTS_2026_08_24';
const SOURCE='ALIBABA_PUBLIC_SHOWROOM';
const observedAt=new Date().toISOString();

const sourceSeeds=[
  ['office:cable-management','cable-management'],
  ['office:desk-organization','desk-organizer'],
  ['office:laptop-accessories','laptop-stand'],
  ['phone-tech:phone-holders','phone-holder'],
  ['phone-tech:tablet-stands','tablet-stand'],
  ['phone-tech:charging-organization','charging-station-organizer'],
  ['home-organization:space-saving-storage','space-saving-storage'],
  ['home-organization:drawer-organization','drawer-organizer'],
  ['home-organization:closet-organization','closet-organizer'],
  ['home-organization:entryway-organization','entryway-organizer'],
  ['kitchen:kitchen-organization','kitchen-organizer'],
  ['kitchen:pantry-storage','pantry-organizer'],
  ['kitchen:sink-organization','sink-organizer'],
  ['kitchen:food-prep-tools','kitchen-tools'],
  ['bathroom:no-drill-storage','bathroom-shelf'],
  ['bathroom:shower-organization','shower-caddy'],
  ['bathroom:sink-organization','bathroom-organizer'],
  ['bathroom:toiletry-storage','toiletry-organizer'],
  ['cleaning-laundry:laundry-organization','laundry-organizer'],
  ['cleaning-laundry:cleaning-storage','cleaning-organizer'],
  ['car-interior:visor-accessories','car-visor-organizer'],
  ['car-interior:seat-organization','car-seat-organizer'],
  ['car-interior:car-storage','car-organizer'],
  ['car-travel:trunk-organization','trunk-organizer'],
  ['baby:stroller-accessories','stroller-organizer'],
  ['baby:baby-travel','baby-travel-bag'],
  ['kids:kids-room-organization','kids-room-organizer'],
  ['toys-education:montessori','montessori-toys'],
  ['dog:dog-travel','dog-travel-bag'],
  ['dog:walking-accessories','dog-walking-accessories'],
  ['cat:cat-home','cat-organizer'],
  ['cat:travel-accessories','cat-carrier'],
  ['packing:packing-cubes','packing-cubes'],
  ['packing:toiletry-organization','toiletry-bag'],
  ['packing:document-organization','travel-document-organizer'],
  ['packing:luggage-accessories','luggage-organizer'],
  ['travel-comfort:airplane-accessories','airplane-accessories'],
  ['travel-comfort:sleep-comfort','travel-pillow'],
  ['beauty:makeup-organization','makeup-organizer'],
  ['beauty:hair-tool-organization','hair-tool-organizer'],
  ['fashion-accessories:jewelry-organization','jewelry-organizer'],
  ['fashion-accessories:shoe-accessories','shoe-organizer'],
  ['fashion-accessories:hat-storage','hat-organizer'],
  ['fitness:resistance-training','resistance-bands'],
  ['fitness:fitness-organization','gym-organizer'],
  ['outdoor:camping-organization','camping-organizer'],
  ['outdoor:picnic-accessories','picnic-bag'],
  ['garden:plant-support','plant-support'],
  ['garden:balcony-organization','balcony-organizer'],
  ['diy:tool-organization','tool-organizer'],
  ['diy:drill-free-mounting','no-drill-shelf'],
  ['party:party-organization','party-organizer'],
  ['party:birthday-accessories','birthday-decoration'],
  ['hobby-craft:craft-organization','craft-organizer'],
  ['seasonal:holiday-organization','holiday-organizer'],
  ['gifts:small-useful-gifts','useful-gifts'],
  ['senior-comfort:home-convenience','home-convenience-products']
];

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const target=Math.max(1000,Math.min(5000,Number(args.target)||1200));
const out=String(args.out||'artifacts/real-public-seed-1000.json');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const decode=s=>String(s||'').replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&').replace(/&#x2F;/gi,'/');
const stripTags=s=>decode(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();

function canonicalProductUrl(raw){
  let u=decode(raw).trim();
  if(u.startsWith('//'))u='https:'+u;
  if(!/^https:\/\//i.test(u))return null;
  try{
    const url=new URL(u);
    if(!/(^|\.)alibaba\.com$/i.test(url.hostname))return null;
    if(!/\/product-detail\//i.test(url.pathname))return null;
    url.protocol='https:';
    url.hash='';url.search='';
    return url.toString();
  }catch{return null;}
}

function nativeId(url){
  const m=String(url).match(/_(\d{8,})\.html(?:$|[?#])/i)||String(url).match(/\/(\d{8,})\.html(?:$|[?#])/i);
  return m?.[1]||null;
}

function titleFromUrl(url){
  try{
    let base=decodeURIComponent(new URL(url).pathname.split('/').pop()||'').replace(/\.html$/i,'');
    base=base.replace(/_\d{8,}$/,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
    return base||'Alibaba product';
  }catch{return'Alibaba product';}
}

function extractProducts(html,meta){
  const body=decode(html);
  const hrefRx=/href\s*=\s*["']([^"']*\/product-detail\/[^"']+)["']/gi;
  const urlRx=/(?:https?:)?\\?\/\\?\/[^"'<>\s]+alibaba\.com\\?\/product-detail\\?\/[^"'<>\s]+?\.html/gi;
  const found=[];let m;
  while((m=hrefRx.exec(body)))found.push({url:canonicalProductUrl(m[1]),at:m.index});
  while((m=urlRx.exec(body)))found.push({url:canonicalProductUrl(m[0]),at:m.index});
  const byUrl=new Map();
  for(const x of found){if(x.url&&!byUrl.has(x.url))byUrl.set(x.url,x.at);}
  const rows=[];let rank=0;
  for(const [url,at] of byUrl){
    rank++;
    const left=Math.max(0,at-1600),right=Math.min(body.length,at+1800);
    const around=body.slice(left,right);
    const titleAttr=[...around.matchAll(/(?:title|alt)\s*=\s*["']([^"']{8,240})["']/gi)].map(x=>stripTags(x[1])).filter(Boolean).sort((a,b)=>b.length-a.length)[0]||null;
    const title=titleAttr||titleFromUrl(url);
    rows.push({
      sourceKey:'ALIBABA_TOP_RANKING',platform:'ALIBABA',surface:'TOP_RANKING',
      externalId:nativeId(url),url,title,
      categoryLabel:meta.mprCategory,sourceCategoryId:meta.slug,sourceRank:rank,
      observedAt,
      evidenceClass:'PUBLIC_PAGE_PRODUCT_OBSERVATION',
      identityEvidence:nativeId(url)?'ALIBABA_NATIVE_PRODUCT_ID_FROM_URL':'REAL_PRODUCT_URL',
      titleEvidence:titleAttr?'PUBLIC_HTML_NEAR_PRODUCT_LINK':'URL_SLUG_DERIVED',
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,
      provenance:{sourcePage:meta.pageUrl,userApproval:USER_APPROVAL,providerCostEur:0}
    });
  }
  return rows;
}

async function fetchPage(url){
  const headers={'user-agent':'Mozilla/5.0 (compatible; MegaProductRadar/1.0; public-market-research)','accept':'text/html,application/xhtml+xml'};
  let last;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(25000)});
      if(!r.ok)throw new Error(`HTTP_${r.status}`);
      const text=await r.text();
      if(text.length<1000)throw new Error('HTML_TOO_SMALL');
      return{text,status:r.status};
    }catch(e){last=e;if(attempt<2)await sleep(1200);}
  }
  throw last;
}

const observations=[];const sourceDiagnostics=[];const globalUrls=new Set();
for(const [mprCategory,slug] of sourceSeeds){
  if(globalUrls.size>=target)break;
  const pageUrl=`https://www.alibaba.com/showroom/${encodeURIComponent(slug)}.html`;
  try{
    const {text}=await fetchPage(pageUrl);
    const rows=extractProducts(text,{mprCategory,slug,pageUrl});
    let added=0;
    for(const row of rows){
      if(globalUrls.size>=target)break;
      if(globalUrls.has(row.url))continue;
      globalUrls.add(row.url);observations.push(row);added++;
    }
    sourceDiagnostics.push({mprCategory,slug,pageUrl,status:'OK',extracted:rows.length,uniqueAdded:added});
  }catch(e){sourceDiagnostics.push({mprCategory,slug,pageUrl,status:'FAILED',error:String(e?.message||e),extracted:0,uniqueAdded:0});}
  await sleep(350);
}

const payload={
  schemaVersion:'REAL_PUBLIC_SEED_1000_V1',generatedAt:observedAt,userApproval:USER_APPROVAL,
  source:SOURCE,target,uniqueProductCount:observations.length,
  sourcePagesAttempted:sourceDiagnostics.length,sourcePagesSucceeded:sourceDiagnostics.filter(x=>x.status==='OK').length,
  sourcePagesFailed:sourceDiagnostics.filter(x=>x.status!=='OK').length,
  sourceDiagnostics,observations,
  policy:{paidCallsTriggered:0,providerSpendEur:0,externalExecutionTriggered:true,executionReason:'EXPLICIT_USER_APPROVAL_TO_REACH_1000_REAL_PRODUCTS',salesEvidenceClass:'NOT_VERIFIED_SALES',crossPlatformAutoMerge:false,purchaseAuthorized:false}
};

await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({out,uniqueProductCount:payload.uniqueProductCount,succeeded:payload.sourcePagesSucceeded,failed:payload.sourcePagesFailed,target},null,2));
if(payload.uniqueProductCount<1000){console.error(`REAL_PRODUCT_TARGET_NOT_REACHED ${payload.uniqueProductCount}/1000`);process.exitCode=2;}
