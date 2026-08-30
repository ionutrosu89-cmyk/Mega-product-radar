const DIRECT_SIGNAL_KEYS=Object.freeze(['amazonUS','amazonDE','amazonIT','amazonFR','tiktok']);
const text=value=>String(value??'').trim();
const num=value=>Number(value||0);
const httpUrl=value=>{const raw=text(value);return /^https?:\/\//i.test(raw)?raw:'';};
const normalize=value=>text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export function freeTop25NicheId(label=''){
  return normalize(label).replace(/\s+/g,'-').toUpperCase()||'ALTELE';
}

function directSignalEvidence(product={}){
  for(const key of DIRECT_SIGNAL_KEYS){
    const signal=product?.signals?.[key];
    if(!signal?.present)continue;
    const direct=(Array.isArray(signal.links)?signal.links:[]).map(link=>({url:httpUrl(link?.url),title:text(link?.title),label:text(link?.label||signal.label)})).find(link=>link.url);
    if(direct)return {url:direct.url,label:direct.label||text(signal.label)||key,resultCount:num(signal.resultCount),evidenceClass:text(signal.evidenceClass||'VERIFIED').toUpperCase()};
  }
  return null;
}

function organicEvidence(product={}){
  const gate=product?.qualityGate||{};
  if(product?.eligibleForFeed!==true||gate.topTwoPages!==true||gate.notPromoted!==true||gate.categoryRelevant!==true)return null;
  const direct=(Array.isArray(product.evidence)?product.evidence:[]).map(row=>({url:httpUrl(row?.url),label:text(row?.marketLabel||product.sourceMarket)})).find(row=>row.url);
  const fallback=httpUrl(product.sourceUrl);
  const url=direct?.url||fallback;
  if(!url)return null;
  return {url,label:direct?.label||text(product.sourceMarket)||'Marketplace public',resultCount:0,evidenceClass:'VERIFIED'};
}

function candidateFromDiscovery(product={}){
  const evidence=directSignalEvidence(product);
  const name=text(product.name),category=text(product.cat||product.category);
  if(!name||!category||!evidence?.url)return null;
  const score=num(product?.discoveryAnalysis?.score||product.score)+num(product?.risingSignal?.eligible?product.risingSignal.score:0);
  return {name,category,score,sourceLabel:evidence.label||'Sursă publică directă',sourceUrl:evidence.url,sourceTier:evidence.evidenceClass==='VERIFIED'?'A':'B',sourceKind:'CATEGORY_LIST',sourcePeriod:'live snapshot',sourceKey:'MPR_LIVE_DISCOVERY',sourceRank:null,metric:evidence.resultCount>0?{label:'Rezultate publice observate',value:evidence.resultCount,unit:'results'}:null,note:'Produs inclus numai pe baza unei surse publice directe.'};
}

function candidateFromOrganic(product={}){
  const evidence=organicEvidence(product);
  const name=text(product.name),category=text(product.category||product.cat);
  if(!name||!category||!evidence?.url)return null;
  const score=num(product.organicRiseScore||product.score);
  return {name,category,score,sourceLabel:evidence.label||'Marketplace public',sourceUrl:evidence.url,sourceTier:'A',sourceKind:'CATEGORY_LIST',sourcePeriod:'live snapshot',sourceKey:'MPR_LIVE_ORGANIC',sourceRank:null,metric:null,note:'Organic Rising eligibil, nepromovat și relevant pentru categorie.'};
}

function mergeCandidates(discoveryProducts=[],organicProducts=[]){
  const byKey=new Map();
  for(const candidate of [
    ...(Array.isArray(discoveryProducts)?discoveryProducts:[]).map(candidateFromDiscovery),
    ...(Array.isArray(organicProducts)?organicProducts:[]).map(candidateFromOrganic)
  ].filter(Boolean)){
    const key=`${normalize(candidate.category)}::${normalize(candidate.name)}`;
    const current=byKey.get(key);
    if(!current||candidate.score>current.score)byKey.set(key,candidate);
  }
  return [...byKey.values()];
}

export function buildFreeTop25LiveUniverse({discoveryProducts=[],organicProducts=[]}={},options={}){
  const limit=Math.max(1,Math.min(25,Number(options.limitPerNiche||25)));
  const minProducts=Math.max(limit,Number(options.minProductsPerNiche||25));
  const candidates=mergeCandidates(discoveryProducts,organicProducts);
  const grouped=new Map();
  for(const candidate of candidates){
    const key=normalize(candidate.category);
    if(!key)continue;
    const rows=grouped.get(key)||[];rows.push(candidate);grouped.set(key,rows);
  }
  const niches=[];
  const coverage=[];
  for(const [key,rows] of grouped){
    rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ro'));
    const label=rows[0].category;
    const eligibleProductCount=rows.length;
    const deficitToTop25=Math.max(0,minProducts-eligibleProductCount);
    coverage.push({
      id:`LIVE_${freeTop25NicheId(label)}`,
      label,
      eligibleProductCount,
      requiredProductCount:minProducts,
      deficitToTop25,
      readinessRatio:Math.min(1,eligibleProductCount/minProducts),
      status:deficitToTop25===0?'TOP25_READY':eligibleProductCount>=Math.ceil(minProducts*0.8)?'NEAR_READY':'BUILDING'
    });
    if(rows.length<minProducts)continue;
    const selected=rows.slice(0,limit).map((row,index)=>({
      name:row.name,rank:index+1,sourceKey:row.sourceKey,sourceLabel:row.sourceLabel,sourceUrl:row.sourceUrl,sourceTier:row.sourceTier,sourceKind:row.sourceKind,sourcePeriod:row.sourcePeriod,sourceRank:null,metric:row.metric,note:row.note,internalRankClass:'DERIVED'
    }));
    niches.push({id:`LIVE_${freeTop25NicheId(label)}`,label,emoji:'📊',mode:'LIVE_EVIDENCE',products:selected,eligibleProductCount});
  }
  niches.sort((a,b)=>b.eligibleProductCount-a.eligibleProductCount||a.label.localeCompare(b.label,'ro'));
  coverage.sort((a,b)=>b.readinessRatio-a.readinessRatio||b.eligibleProductCount-a.eligibleProductCount||a.label.localeCompare(b.label,'ro'));
  const totalDeficit=coverage.reduce((sum,row)=>sum+row.deficitToTop25,0);
  const nearReadyNicheCount=coverage.filter(row=>row.status==='NEAR_READY').length;
  return {
    schema:'MPR_FREE_TOP25_LIVE_V1',
    truthPolicy:{completeTop25Required:true,directPublicEvidenceRequired:true,supplierDataExposed:false,economicsExposed:false,unknownEqualsZero:false,purchaseAuthorized:false,commercialEligibilityMeasuredOnlyFromAcceptedLiveEvidence:true},
    stats:{eligibleCandidates:candidates.length,observedNicheCount:coverage.length,completeNicheCount:niches.length,nearReadyNicheCount,totalDeficitToCompleteAllObservedNiches:totalDeficit,limitPerNiche:limit,minProductsPerNiche:minProducts},
    coverage,
    niches
  };
}
