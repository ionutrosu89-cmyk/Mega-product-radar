const text=v=>String(v??'').trim();

export function flattenCategoryUniverse(taxonomy={}){
  const rows=[];
  for(const department of taxonomy?.departments||[]){
    for(const category of department?.children||[]){
      for(const niche of category?.niches||[]){
        rows.push({
          departmentKey:text(department.key),departmentLabel:text(department.label),
          categoryKey:text(category.key),categoryLabel:text(category.label),
          nicheKey:text(niche),mprCategory:`${text(category.key)}:${text(niche)}`
        });
      }
    }
  }
  return rows;
}

function mappingStatus(mapping={}){
  if(mapping?.approved===true)return'APPROVED';
  const hasAny=Boolean(text(mapping?.amazon?.categoryPath)||text(mapping?.alibaba?.categorySlug)||text(mapping?.ebay?.categoryId));
  return hasAny?'NEEDS_REVIEW':'UNMAPPED';
}

export function buildCategoryMappingReviewQueue({taxonomy={},mappings=[]}={}){
  const niches=flattenCategoryUniverse(taxonomy);
  const byCategory=new Map((mappings||[]).map(x=>[text(x?.mprCategory),x]));
  const rows=niches.map(niche=>{
    const mapping=byCategory.get(niche.mprCategory)||{};
    const status=mappingStatus(mapping);
    return{
      ...niche,status,
      amazon:mapping.amazon||null,
      alibaba:mapping.alibaba||null,
      ebay:mapping.ebay||null,
      approved:status==='APPROVED',
      approvalEvidence:text(mapping.approvalEvidence)||null,
      reviewedBy:text(mapping.reviewedBy)||null,
      reviewedAt:text(mapping.reviewedAt)||null,
      executable:status==='APPROVED'
    };
  });
  const priority={NEEDS_REVIEW:0,UNMAPPED:1,APPROVED:2};
  rows.sort((a,b)=>(priority[a.status]??9)-(priority[b.status]??9)||a.mprCategory.localeCompare(b.mprCategory));
  return{
    totalNiches:rows.length,
    approved:rows.filter(x=>x.status==='APPROVED').length,
    needsReview:rows.filter(x=>x.status==='NEEDS_REVIEW').length,
    unmapped:rows.filter(x=>x.status==='UNMAPPED').length,
    rows,
    rule:'ONLY_EXPLICITLY_APPROVED_MAPPINGS_CAN_ENTER_PUBLIC_SEED_MANIFEST',
    externalExecutionTriggered:false,
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}

export function validateMarketplaceCategoryMapping(mapping={}){
  const errors=[];
  const mprCategory=text(mapping?.mprCategory);
  if(!mprCategory)errors.push('MPR_CATEGORY_REQUIRED');

  const amazon=mapping?.amazon||{};
  if(amazon.categoryPath!==undefined&&!text(amazon.categoryPath))errors.push('AMAZON_CATEGORY_PATH_INVALID');
  if(Array.isArray(amazon.markets)&&amazon.markets.length===0)errors.push('AMAZON_MARKETS_EMPTY');
  if(Array.isArray(amazon.surfaces)&&amazon.surfaces.length===0)errors.push('AMAZON_SURFACES_EMPTY');

  const alibaba=mapping?.alibaba||{};
  if(alibaba.categorySlug!==undefined&&!text(alibaba.categorySlug))errors.push('ALIBABA_CATEGORY_SLUG_INVALID');

  const ebay=mapping?.ebay||{};
  if(ebay.categoryId!==undefined&&!/^\d+$/.test(text(ebay.categoryId)))errors.push('EBAY_CATEGORY_ID_INVALID');

  if(mapping?.approved===true){
    const hasSource=Boolean(text(amazon.categoryPath)||text(alibaba.categorySlug)||text(ebay.categoryId));
    if(!hasSource)errors.push('APPROVED_MAPPING_REQUIRES_SOURCE_MAPPING');
    if(!text(mapping.approvalEvidence))errors.push('APPROVAL_EVIDENCE_REQUIRED');
    if(!text(mapping.reviewedAt))errors.push('REVIEWED_AT_REQUIRED');
  }

  return{ok:errors.length===0,errors,approved:mapping?.approved===true,executable:errors.length===0&&mapping?.approved===true,purchaseAuthorized:false};
}

export function approvedMappingsForSeed({taxonomy={},mappings=[]}={}){
  const known=new Set(flattenCategoryUniverse(taxonomy).map(x=>x.mprCategory));
  const approved=[];const rejected=[];
  for(const mapping of mappings||[]){
    const key=text(mapping?.mprCategory);
    const validation=validateMarketplaceCategoryMapping(mapping);
    if(!known.has(key)){rejected.push({mprCategory:key||null,error:'MPR_CATEGORY_NOT_IN_CANONICAL_TAXONOMY'});continue;}
    if(!validation.executable){rejected.push({mprCategory:key,error:validation.errors.join('|')||'NOT_APPROVED'});continue;}
    approved.push({...mapping,approved:true});
  }
  return{approved,rejected,approvedCount:approved.length,rejectedCount:rejected.length,externalExecutionTriggered:false,paidCallsTriggered:0,purchaseAuthorized:false};
}
