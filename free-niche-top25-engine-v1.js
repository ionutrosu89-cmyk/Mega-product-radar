const DIRECT_SIGNAL_KEYS=Object.freeze(['amazonUS','amazonDE','amazonIT','amazonFR','tiktok']);
const text=value=>String(value??'').trim();
const num=value=>Number(value||0);
const httpUrl=value=>{const raw=text(value);return /^https?:\/\//i.test(raw)?raw:'';};
const normalize=value=>text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const labelFromKey=value=>text(value).split('-').filter(Boolean).map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' ');

function directSignalEvidence(product={}){
  for(const key of DIRECT_SIGNAL_KEYS){
    const signal=product?.signals?.[key];
    if(!signal?.present)continue;
    const direct=(Array.isArray(signal.links)?signal.links:[])
      .map(link=>({url:httpUrl(link?.url),label:text(link?.label||signal.label)}))
      .find(link=>link.url);
    if(direct)return {url:direct.url,label:direct.label||text(signal.label)||key,resultCount:num(signal.resultCount),evidenceClass:text(signal.evidenceClass||'VERIFIED').toUpperCase()};
  }
  return null;
}

function eligibleCandidate(product={},kind='DISCOVERY'){
  if(kind==='DISCOVERY'){
    const evidence=directSignalEvidence(product);
    const name=text(product.name),category=text(product.cat||product.category);
    if(!name||!category||!evidence?.url)return null;
    return {name,category,nicheKey:text(product.nicheKey||product.niche_key),productKey:text(product.asin||product.productKey||product.product_id||name),score:num(product?.discoveryAnalysis?.score||product.score)+num(product?.risingSignal?.eligible?product.risingSignal.score:0),sourceLabel:evidence.label||'Sursă publică directă',sourceUrl:evidence.url,sourceTier:evidence.evidenceClass==='VERIFIED'?'A':'B',sourceKind:'CATEGORY_LIST',sourcePeriod:'live snapshot',sourceKey:'MPR_LIVE_DISCOVERY',metric:evidence.resultCount>0?{label:'Rezultate publice observate',value:evidence.resultCount,unit:'results'}:null,note:'Produs inclus numai pe baza unei surse publice directe.'};
  }
  if(kind==='ORGANIC'){
    const gate=product?.qualityGate||{};
    if(product?.eligibleForFeed!==true||gate.topTwoPages!==true||gate.notPromoted!==true||gate.categoryRelevant!==true)return null;
    const direct=(Array.isArray(product.evidence)?product.evidence:[]).map(row=>({url:httpUrl(row?.url),label:text(row?.marketLabel||product.sourceMarket)})).find(row=>row.url);
    const sourceUrl=direct?.url||httpUrl(product.sourceUrl);
    const name=text(product.name),category=text(product.category||product.cat);
    if(!name||!category||!sourceUrl)return null;
    return {name,category,nicheKey:text(product.nicheKey||product.niche_key),productKey:text(product.asin||product.productKey||product.product_id||name),score:num(product.organicRiseScore||product.score),sourceLabel:direct?.label||text(product.sourceMarket)||'Marketplace public',sourceUrl,sourceTier:'A',sourceKind:'CATEGORY_LIST',sourcePeriod:'live snapshot',sourceKey:'MPR_LIVE_ORGANIC',metric:null,note:'Organic Rising eligibil, nepromovat și relevant pentru categorie.'};
  }
  if(product?.eligibleForFreeTop25!==true||text(product.evidenceClass)!=='LIVE_PUBLIC_PRODUCT_PAGE'||text(product.salesEvidenceClass)!=='NOT_VERIFIED_SALES'||product.purchaseAuthorized!==false)return null;
  const name=text(product.name),category=text(product.category),sourceUrl=httpUrl(product.sourceUrl),score=num(product.score),reviews=Number(product.reviewCount);
  if(!name||!category||!sourceUrl||!score)return null;
  return {name,category,nicheKey:text(product.nicheKey||product.niche_key),productKey:text(product.asin||product.productKey||product.product_id||name),score,sourceLabel:'Amazon US · pagină publică live',sourceUrl,sourceTier:'A',sourceKind:'PRODUCT_PAGE',sourcePeriod:'live snapshot',sourceKey:'AMAZON_LIVE_CATALOG_BRIDGE',metric:Number.isFinite(reviews)?{label:'Recenzii publice observate',value:reviews,unit:'reviews'}:null,note:'Clasare derivată din rating și numărul de recenzii publice. Nu reprezintă vânzări estimate.'};
}

function eligibleCandidates({discoveryProducts=[],organicProducts=[],amazonLiveProducts=[]}={}){
  const byKey=new Map();
  const rows=[
    ...discoveryProducts.map(row=>eligibleCandidate(row,'DISCOVERY')),
    ...organicProducts.map(row=>eligibleCandidate(row,'ORGANIC')),
    ...amazonLiveProducts.map(row=>eligibleCandidate(row,'AMAZON_LIVE'))
  ].filter(Boolean);
  for(const row of rows){
    const key=`${normalize(row.category)}::${normalize(row.productKey||row.name)}`;
    const current=byKey.get(key);
    if(!current||row.score>current.score)byKey.set(key,row);
  }
  return [...byKey.values()];
}

export function flattenFreeNicheTaxonomy(taxonomy={}){
  const rows=[];
  for(const department of Array.isArray(taxonomy.departments)?taxonomy.departments:[]){
    for(const category of Array.isArray(department.children)?department.children:[]){
      for(const nicheKey of Array.isArray(category.niches)?category.niches:[]){
        const qualifiedKey=`${category.key}:${nicheKey}`;
        rows.push({
          id:qualifiedKey.toUpperCase().replace(/[^A-Z0-9]+/g,'_'),
          nicheKey:qualifiedKey,
          nicheSlug:normalize(nicheKey),
          label:labelFromKey(nicheKey),
          categoryKey:text(category.key),
          categoryLabel:text(category.label),
          departmentKey:text(department.key),
          departmentLabel:text(department.label),
          targetProducts:25
        });
      }
    }
  }
  return rows;
}

function candidateNiche(candidate,registry){
  const explicit=normalize(candidate.nicheKey);
  if(explicit){
    const exact=registry.find(row=>normalize(row.nicheKey)===explicit);
    if(exact)return exact;
    const bySlug=registry.filter(row=>row.nicheSlug===explicit);
    if(bySlug.length===1)return bySlug[0];
  }
  const category=normalize(candidate.category);
  const matches=registry.filter(row=>normalize(row.categoryKey)===category||normalize(row.categoryLabel)===category||row.nicheSlug===category);
  return matches.length===1?matches[0]:null;
}

function publicProduct(row,rank){
  return {rank,name:row.name,sourceKey:row.sourceKey,sourceLabel:row.sourceLabel,sourceUrl:row.sourceUrl,sourceTier:row.sourceTier,sourceKind:row.sourceKind,sourcePeriod:row.sourcePeriod,metric:row.metric,note:row.note,internalRankClass:'DERIVED'};
}

export function buildFreeNicheTop25Plan({taxonomy,discoveryProducts=[],organicProducts=[],amazonLiveProducts=[]}={},options={}){
  const registry=flattenFreeNicheTaxonomy(taxonomy);
  const candidates=eligibleCandidates({discoveryProducts,organicProducts,amazonLiveProducts});
  const grouped=new Map(registry.map(row=>[row.nicheKey,new Map()]));
  let unmappedCandidateCount=0;
  for(const candidate of candidates){
    const niche=candidateNiche(candidate,registry);
    if(!niche){unmappedCandidateCount++;continue;}
    const identity=normalize(candidate.productKey||candidate.name);
    if(!identity)continue;
    const products=grouped.get(niche.nicheKey);
    const current=products.get(identity);
    if(!current||candidate.score>current.score)products.set(identity,candidate);
  }
  const coverage=registry.map(niche=>{
    const accepted=[...grouped.get(niche.nicheKey).values()].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ro'));
    const acceptedProductCount=accepted.length;
    const deficitToTop25=Math.max(0,25-acceptedProductCount);
    const status=deficitToTop25===0?'COMPLETE':acceptedProductCount===0?'NOT_STARTED':acceptedProductCount>=20?'NEAR_READY':'BUILDING';
    return {...niche,acceptedProductCount,deficitToTop25,completionPct:Math.min(100,Math.round(acceptedProductCount/25*100)),status,products:status==='COMPLETE'?accepted.slice(0,25).map((row,index)=>publicProduct(row,index+1)):[]};
  });
  const query=normalize(options.query),nicheFilter=normalize(options.niche);
  const visible=coverage.filter(row=>{
    if(nicheFilter&&normalize(row.nicheKey)!==nicheFilter&&normalize(row.id)!==nicheFilter)return false;
    if(!query)return true;
    return [row.label,row.nicheKey,row.categoryLabel,row.departmentLabel].some(value=>normalize(value).includes(query));
  });
  const completeNicheCount=coverage.filter(row=>row.status==='COMPLETE').length;
  const acceptedProductSlots=coverage.reduce((sum,row)=>sum+Math.min(25,row.acceptedProductCount),0);
  return {
    schema:'MPR_FREE_NICHE_TOP25_PLAN_V1',
    planStatus:completeNicheCount===registry.length&&registry.length>0?'COMPLETE':'IN_PROGRESS',
    truthPolicy:{exactly25RequiredForComplete:true,directPublicEvidenceRequired:true,incompleteNicheProductsHidden:true,supplierDataExposed:false,economicsExposed:false,verifiedSalesClaimed:false,purchaseAuthorized:false},
    stats:{totalNiches:registry.length,completeNicheCount,remainingNicheCount:registry.length-completeNicheCount,targetProductSlots:registry.length*25,acceptedProductSlots,remainingProductSlots:registry.length*25-acceptedProductSlots,eligibleCandidateCount:candidates.length,unmappedCandidateCount},
    niches:visible
  };
}
