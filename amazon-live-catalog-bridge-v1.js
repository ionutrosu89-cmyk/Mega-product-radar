const text=value=>String(value??'').trim();
const finite=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
const round2=value=>Math.round(value*100)/100;

function parseCategoryPath(value){
  if(Array.isArray(value))return value.map(text).filter(Boolean);
  const raw=text(value);if(!raw)return [];
  try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.map(text).filter(Boolean):[];}catch{return [];}
}

function fieldIndex(fields=[]){return Object.fromEntries((Array.isArray(fields)?fields:[]).map((name,index)=>[name,index]));}

export function amazonCatalogNiche(categoryLabel='',depth=2){
  const path=parseCategoryPath(categoryLabel);
  const take=Math.max(1,Math.min(path.length||1,Number(depth)||2));
  return {path,label:path.slice(0,take).join(' › ')};
}

export function amazonEngagementSignal(rating,reviewCount){
  const r=finite(rating),reviews=finite(reviewCount);
  if(r===null||reviews===null||r<0||r>5||reviews<0)return null;
  return round2((r/5)*60+Math.min(40,Math.log10(reviews+1)*10));
}

export function buildAmazonLiveCatalogBridge({bootstrap={},liveCompact={}}={},options={}){
  const bootstrapIdx=fieldIndex(bootstrap.fields),liveIdx=fieldIndex(liveCompact.fields);
  const requiredBootstrap=['asin','title','brand','categoryLabel'];
  const requiredLive=['asin','title','price','currency','rating','reviewCount','observedAt','statusCode','htmlBytes'];
  if(requiredBootstrap.some(key=>bootstrapIdx[key]===undefined))throw new Error('AMAZON_BOOTSTRAP_FIELDS_INVALID');
  if(requiredLive.some(key=>liveIdx[key]===undefined))throw new Error('AMAZON_LIVE_FIELDS_INVALID');
  const policy=liveCompact.policy||{};
  if(policy.freshnessClass!=='LIVE_PUBLIC_PAGE'||policy.salesEvidenceClass!=='NOT_VERIFIED_SALES'||policy.providerSpendEur!==0||policy.paidCallsTriggered!==0||policy.purchaseAuthorized!==false||policy.trendAuthorized!==false)throw new Error('AMAZON_LIVE_POLICY_INVALID');
  const baseline=new Map();
  for(const row of Array.isArray(bootstrap.products)?bootstrap.products:[]){
    const asin=text(row?.[bootstrapIdx.asin]).toUpperCase();if(!asin)continue;
    baseline.set(asin,{asin,title:text(row[bootstrapIdx.title]),brand:text(row[bootstrapIdx.brand]),categoryLabel:row[bootstrapIdx.categoryLabel]});
  }
  const products=[];const diagnostics={liveRows:0,exactAsinJoins:0,missingBootstrapAsin:0,missingCategory:0,missingEngagementSignal:0,invalidHttpEvidence:0};
  for(const row of Array.isArray(liveCompact.products)?liveCompact.products:[]){
    diagnostics.liveRows+=1;
    const asin=text(row?.[liveIdx.asin]).toUpperCase(),base=baseline.get(asin);
    if(!base){diagnostics.missingBootstrapAsin+=1;continue;}
    const statusCode=finite(row[liveIdx.statusCode]),htmlBytes=finite(row[liveIdx.htmlBytes]);
    if(statusCode===null||statusCode<200||statusCode>=300||htmlBytes===null||htmlBytes<=0){diagnostics.invalidHttpEvidence+=1;continue;}
    const niche=amazonCatalogNiche(base.categoryLabel,options.categoryDepth||2);
    if(!niche.label){diagnostics.missingCategory+=1;continue;}
    const rating=finite(row[liveIdx.rating]),reviewCount=finite(row[liveIdx.reviewCount]),score=amazonEngagementSignal(rating,reviewCount);
    if(score===null){diagnostics.missingEngagementSignal+=1;continue;}
    diagnostics.exactAsinJoins+=1;
    products.push({
      externalId:asin,
      name:text(row[liveIdx.title])||base.title,
      brand:base.brand,
      category:niche.label,
      categoryPath:niche.path,
      score,
      rating,
      reviewCount,
      price:finite(row[liveIdx.price]),
      currency:text(row[liveIdx.currency])||null,
      observedAt:text(row[liveIdx.observedAt]),
      sourceUrl:`https://www.amazon.com/dp/${asin}`,
      sourceKey:'AMAZON_LIVE_CATALOG_BRIDGE',
      evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      eligibleForFreeTop25:true,
      purchaseAuthorized:false
    });
  }
  products.sort((a,b)=>b.score-a.score||b.reviewCount-a.reviewCount||a.externalId.localeCompare(b.externalId));
  return {
    schema:'MPR_AMAZON_LIVE_CATALOG_BRIDGE_V1',
    generatedAt:new Date().toISOString(),
    truthPolicy:{exactAsinJoinRequired:true,bootstrapIdentityOnly:true,bootstrapMetricsNotUsed:true,livePublicPageRequired:true,engagementSignalIsNotSales:true,categoryDerivedOnlyFromSourceHierarchy:true,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false},
    stats:{eligibleProducts:products.length,...diagnostics},
    products
  };
}
