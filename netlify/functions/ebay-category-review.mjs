import {timingSafeEqual} from 'node:crypto';
import {getEbayCategorySuggestions,getEbayCategoryCoverageReview} from './_ebay-taxonomy-review.mjs';

const clean=value=>String(value??'').trim();
const safeEqual=(left,right)=>{const a=Buffer.from(clean(left));const b=Buffer.from(clean(right));return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);};

export function createEbayCategoryReviewHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
  return async request=>{
    if(request.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{allow:'POST','Cache-Control':'no-store'}});
    if(!safeEqual(request.headers.get('x-mpr-internal-secret'),env.MPR_INTERNAL_REFRESH_SECRET))return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
    let payload; try{payload=await request.json();}catch{return Response.json({ok:false,error:'Invalid JSON'},{status:400,headers:{'Cache-Control':'no-store'}});}
    if(String(payload?.mode||'').toUpperCase()==='COVERAGE'){
      const requested=Array.isArray(payload?.marketplaceIds)?payload.marketplaceIds:['EBAY_US','EBAY_DE'];
      const unique=[...new Set(requested.map(value=>String(value||'').trim().toUpperCase()).filter(Boolean))].slice(0,2);
      const reviews=[];
      for(const marketplaceId of unique)reviews.push(await getEbayCategoryCoverageReview({marketplaceId,termsByNiche:payload?.termsByNiche?.[marketplaceId],env,fetchImpl,now}));
      const providerCalls=reviews.reduce((sum,row)=>sum+Number(row?.providerCalls||0),0);
      const ok=reviews.length>0&&reviews.every(row=>row.ok);
      return Response.json({ok,code:ok?'REVIEW_REQUIRED':'COVERAGE_REVIEW_INCOMPLETE',providerCalls,reviews,policy:{humanApprovalRequired:true,autoActivation:false,syntheticProductRanking:false,purchaseAuthorized:false}},{status:ok?200:(providerCalls===0?409:502),headers:{'Cache-Control':'no-store'}});
    }
    const result=await getEbayCategorySuggestions({query:payload?.query,marketplaceId:payload?.marketplaceId,env,fetchImpl,now});
    const status=result.ok?200:(result.providerCalls===0?409:502);
    return Response.json({...result,policy:{...(result.policy||{}),humanApprovalRequired:true,purchaseAuthorized:false}},{status,headers:{'Cache-Control':'no-store'}});
  };
}

export default createEbayCategoryReviewHandler();
export const config={path:'/api/internal/ebay-category-review',method:'POST'};
