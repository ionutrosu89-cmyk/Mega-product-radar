import fs from 'node:fs/promises';
import path from 'node:path';
import {buildProductFingerprint} from '../product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from '../marketplace-supplier-matching-v1.js';

const queuePath=process.argv[2]||'artifacts/matching-audit/detail-enrichment-queue.json';
const outDir=process.argv[3]||'artifacts/top-candidate-detail-enrichment';
const limit=Math.max(1,Math.min(20,Number(process.argv[4]||10)));
const doc=JSON.parse(await fs.readFile(queuePath,'utf8'));
const rows=(Array.isArray(doc)?doc:(doc.rows??[])).slice(0,limit);
const observedAt=new Date().toISOString();

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const decode=s=>String(s??'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const textOnly=s=>clean(decode(String(s??'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')));
const inchToCm=n=>Number((Number(n)*2.54).toFixed(3));

function firstSection(html,startPattern,endPatterns=[]){
  const m=startPattern.exec(html);if(!m)return'';
  const start=m.index;
  let end=Math.min(html.length,start+30000);
  for(const p of endPatterns){const e=p.exec(html.slice(start+1));if(e)end=Math.min(end,start+1+e.index);}
  return html.slice(start,end);
}

function parseDimensions(text){
  const s=clean(text).toLowerCase();
  const m=s.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|×)\s*(\d+(?:\.\d+)?))?\s*(inches?|inch|in\b|cm\b|mm\b)/i);
  if(!m)return null;
  let vals=[Number(m[1]),Number(m[2]),m[3]?Number(m[3]):null].filter(v=>Number.isFinite(v)&&v>0);
  const unit=m[4].toLowerCase();
  if(unit.startsWith('in'))vals=vals.map(inchToCm);
  else if(unit==='mm')vals=vals.map(v=>Number((v/10).toFixed(3)));
  const [lengthCm,widthCm,heightCm]=vals;
  return {lengthCm:lengthCm??null,widthCm:widthCm??null,heightCm:heightCm??null};
}

function explicitPackCount(text){
  const s=clean(text).toLowerCase();
  const patterns=[/pack\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s*[- ]?pack\b/,/\b(\d{1,3})\s*[- ]?piece\s+set\b/,/\bset\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s+count\b/];
  for(const p of patterns){const m=s.match(p);if(m&&Number(m[1])>0)return Number(m[1]);}
  return null;
}

function extractMaterial(text){
  const s=` ${clean(text).toLowerCase()} `;
  const materials=['metal mesh','stainless steel','carbon steel','metal','steel','wood','bamboo','plastic','acrylic','felt','wicker','rattan','leather','faux leather','neoprene','cotton'];
  const found=materials.filter(x=>s.includes(` ${x} `));
  if(found.includes('metal mesh'))return 'metal mesh';
  if(found.includes('stainless steel'))return 'stainless steel';
  if(found.includes('carbon steel'))return 'carbon steel';
  const canonical=[...new Set(found.map(x=>x==='steel'?'metal':x==='wicker'||x==='rattan'?'rattan/wicker':x))];
  return canonical.length===1?canonical[0]:null;
}

function classifyProductType(text){
  const s=clean(text).toLowerCase();
  const rules=[
    [/monitor stand|monitor riser/,'monitor stand'],
    [/desk organizer|desktop organizer|desk set organizer/,'desk organizer'],
    [/letter tray|file tray|file organizer|paper tray/,'file tray organizer'],
    [/cable clip|cord clip/,'cable clip'],
    [/cable management sleeve|cord sleeve/,'cable sleeve'],
    [/cable management box|cord organizer box|socket storage/,'cable management box'],
    [/desk mat|mouse pad|desk pad/,'desk mat'],
    [/vanity organizer|makeup organizer|skincare.*organizer/,'vanity organizer'],
    [/floating shelf|wall shelf|wall shelves/,'wall shelf'],
    [/storage box|storage basket|organizer basket/,'storage container'],
    [/charging station|docking station/,'charging station'],
    [/wireless charger/,'wireless charger'],
    [/can organizer|can rack|beverage dispenser/,'can organizer']
  ];
  for(const [p,v] of rules)if(p.test(s))return v;
  return null;
}
function primaryFunction(productType){
  const map={'monitor stand':'raise monitor','desk organizer':'organize desk supplies','file tray organizer':'organize documents','cable clip':'secure cables','cable sleeve':'bundle cables','cable management box':'conceal cables','desk mat':'protect desk surface','vanity organizer':'organize cosmetics','wall shelf':'wall storage','storage container':'store items','charging station':'organize and charge devices','wireless charger':'charge devices','can organizer':'organize beverage cans'};
  return map[productType]??null;
}
function formFactor(text){
  const s=clean(text).toLowerCase();
  if(/under[- ]desk/.test(s))return 'under desk';
  if(/wall[- ]mounted|wall mounted|floating shelf/.test(s))return 'wall mounted';
  if(/countertop/.test(s))return 'countertop';
  if(/desktop|desk organizer|monitor stand|desk mat/.test(s))return 'desktop';
  return null;
}
function technicalSpecs(text){
  const s=clean(text).toLowerCase();const out={};
  const tier=s.match(/\b(\d{1,2})\s*[- ]?tier\b/);if(tier)out.tiers=Number(tier[1]);
  const comp=s.match(/\b(\d{1,2})\s*[- ]?compartment/);if(comp)out.compartments=Number(comp[1]);
  const pen=s.match(/\b(\d{1,2})\s+pen\s+holders?\b/);if(pen)out.penHolders=Number(pen[1]);
  const drawer=s.match(/\b(\d{1,2})\s+drawers?\b/);if(drawer)out.drawers=Number(drawer[1]);
  return out;
}
function extractAttributes(text){
  const productType=classifyProductType(text);
  return {productType,primaryFunction:primaryFunction(productType),material:extractMaterial(text),dimensions:parseDimensions(text),packCount:explicitPackCount(text),formFactor:formFactor(text),technicalSpecs:technicalSpecs(text),sourceTitle:clean(text).slice(0,1000)};
}

async function fetchHtml(url,kind){
  const headers={'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9'};
  try{
    const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(20000)});
    const html=await r.text();
    const blocked=kind==='AMAZON'?/robot check|enter the characters you see below|sorry! something went wrong/i.test(html):/captcha|security verification|verify.*human|punish|risk.*control/i.test(html);
    return{ok:r.ok&&!blocked,statusCode:r.status,blocked,htmlBytes:html.length,html,error:null,finalUrl:r.url};
  }catch(e){return{ok:false,statusCode:null,blocked:false,htmlBytes:0,html:'',error:String(e?.message||e),finalUrl:url};}
}
function amazonEvidence(html){
  const title=textOnly(html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
  const bullets=textOnly(firstSection(html,/<div[^>]+id=["']feature-bullets["'][^>]*>/i,[/<div[^>]+id=["']productOverview_feature_div["']/i,/<div[^>]+id=["']aplus["']/i]));
  const details=textOnly(firstSection(html,/<div[^>]+id=["']productDetails/i,[/<div[^>]+id=["']reviewsMedley/i,/<footer/i]));
  const combined=clean([title,bullets,details].filter(Boolean).join(' | ')).slice(0,20000);
  return{title:title||null,combinedText:combined,attributes:extractAttributes(combined||title)};
}
function alibabaEvidence(html,fallbackTitle=''){
  const og=decode(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]||'');
  const body=textOnly(html).slice(0,30000);
  const combined=clean([og,fallbackTitle,body].filter(Boolean).join(' | ')).slice(0,20000);
  return{title:clean(og)||fallbackTitle||null,combinedText:combined,attributes:extractAttributes(combined||fallbackTitle)};
}

const enriched=[];
for(const row of rows){
  const amazonUrl=`https://www.amazon.com/dp/${encodeURIComponent(row.amazonAsin)}`;
  const supplierUrl=row.sourceRefs?.supplier;
  const [a,s]=await Promise.all([fetchHtml(amazonUrl,'AMAZON'),fetchHtml(supplierUrl,'ALIBABA')]);
  const ae=amazonEvidence(a.html);
  const se=alibabaEvidence(s.html,row.supplierTitle);
  const mp=buildProductFingerprint({...ae.attributes,sourceTitle:row.marketplaceTitle});
  const sp=buildProductFingerprint({...se.attributes,category:null,sourceTitle:row.supplierTitle});
  const match=matchMarketplaceToSupplier(mp,sp,{screeningThreshold:80});
  enriched.push({
    amazonAsin:row.amazonAsin,supplierListingKey:row.supplierListingKey,
    marketplaceTitle:row.marketplaceTitle,supplierTitle:row.supplierTitle,
    marketplacePrice:row.marketplacePrice,supplierPriceMax:row.supplierPriceMax,supplierMoq:row.supplierMoq,supplierPriceTiers:row.supplierPriceTiers,
    titleOverlap:row.titleOverlap,previousMatchConfidence:row.matchConfidence,
    amazonFetch:{ok:a.ok,statusCode:a.statusCode,blocked:a.blocked,htmlBytes:a.htmlBytes,error:a.error,finalUrl:a.finalUrl},
    supplierFetch:{ok:s.ok,statusCode:s.statusCode,blocked:s.blocked,htmlBytes:s.htmlBytes,error:s.error,finalUrl:s.finalUrl},
    amazonExtracted:ae.attributes,supplierExtracted:se.attributes,
    enrichedMatch:match,
    sourceRefs:{marketplace:amazonUrl,supplier:supplierUrl},
    truthPolicy:{publicHtmlIsVerifiedQuote:false,detailEnrichmentIsManualConfirmation:false,unknownEqualsZero:false,titleSimilarityAloneIsSufficient:false,purchaseAuthorized:false}
  });
  await new Promise(r=>setTimeout(r,400));
}
const eligible=enriched.filter(x=>x.enrichedMatch.screeningEconomicsEligible);
const summary={schemaVersion:'MPR_TOP_CANDIDATE_DETAIL_ENRICHMENT_V1',generatedAt:observedAt,requestedPairs:rows.length,amazonFetchOk:enriched.filter(x=>x.amazonFetch.ok).length,amazonBlocked:enriched.filter(x=>x.amazonFetch.blocked).length,supplierFetchOk:enriched.filter(x=>x.supplierFetch.ok).length,supplierBlocked:enriched.filter(x=>x.supplierFetch.blocked).length,maxEnrichedMatchConfidence:enriched.length?Math.max(...enriched.map(x=>x.enrichedMatch.matchConfidence)):null,screeningEligibleMatchCount:eligible.length,rows:enriched,policy:{paidCallsTriggered:0,providerSpendUsd:0,publicSupplierPageIsVerifiedQuote:false,marketplacePageIsRealizedSale:false,unknownEqualsZero:false,purchaseAuthorized:false,negotiationIncluded:false}};
await fs.mkdir(outDir,{recursive:true});
await fs.writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,rows:undefined},null,2));
