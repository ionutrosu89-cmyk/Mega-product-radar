import {getEbayCategoryCoverageReview} from '../netlify/functions/_ebay-taxonomy-review.mjs';
import {ebayBuyAccessState} from '../netlify/functions/_ebay-buy-auth.mjs';
import {classifyEbayTaxonomyPath} from '../ebay-taxonomy-path-policy-v1.js';
import {SAAS_CONFIG} from '../saas-config.js';

const env=process.env;
const clean=value=>String(value??'').trim();
const isProduction=String(env.CONTEXT||'').toLowerCase()==='production';
const accessState=ebayBuyAccessState(env);

if(!isProduction||accessState!=='READY_TO_COLLECT'){
  console.log(JSON.stringify({capture:'EBAY_TAXONOMY',skipped:true,context:clean(env.CONTEXT)||'unknown',accessState}));
  process.exit(0);
}

const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
const service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
if(!supabaseUrl||!service){
  console.log(JSON.stringify({capture:'EBAY_TAXONOMY',skipped:true,reason:'PERSISTENCE_NOT_CONFIGURED'}));
  process.exit(0);
}

const observedAt=new Date().toISOString();
const markets=['EBAY_US','EBAY_DE'];
const summary=[];

for(const marketplaceId of markets){
  try{
    const review=await getEbayCategoryCoverageReview({marketplaceId,env,fetchImpl:fetch,now:()=>Date.now()});
    if(!review.ok){
      summary.push({marketplaceId,ok:false,code:review.code||'UNKNOWN',providerCalls:Number(review.providerCalls||0),rows:0});
      continue;
    }
    const rows=[];
    let pathMatched=0;
    let pathRejected=0;
    for(const target of review.targets||[]){
      for(const candidate of target.candidates||[]){
        const pathGate=classifyEbayTaxonomyPath(target.nicheId,candidate);
        if(pathGate.accepted)pathMatched++; else pathRejected++;
        rows.push({
          marketplace_id:marketplaceId,
          niche_id:target.nicheId,
          niche_label:target.nicheLabel,
          category_tree_id:review.categoryTreeId,
          category_tree_version:review.categoryTreeVersion||null,
          candidate_rank:candidate.candidateRank,
          category_id:candidate.categoryId,
          category_name:candidate.categoryName,
          category_path:candidate.path||[],
          review_score:candidate.reviewScore,
          leaf:Boolean(candidate.leaf),
          review_state:pathGate.accepted?'PATH_VALIDATED_REVIEW_REQUIRED':pathGate.decision,
          activation_eligible:false,
          evidence_class:'EBAY_CATEGORY_TREE_REVIEW_CANDIDATE',
          observed_at:observedAt
        });
      }
    }
    const url=new URL(`${supabaseUrl}/rest/v1/ebay_taxonomy_mapping_candidates_v1`);
    url.searchParams.set('on_conflict','marketplace_id,niche_id,candidate_rank');
    const response=await fetch(url,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows),signal:AbortSignal.timeout(30000)});
    summary.push({marketplaceId,ok:response.ok,code:response.ok?'CAPTURED':`SUPABASE_HTTP_${response.status}`,providerCalls:Number(review.providerCalls||0),targets:Number(review.targetCount||0),rows:rows.length,pathMatched,pathRejected});
  }catch(error){
    summary.push({marketplaceId,ok:false,code:String(error?.message||error).slice(0,120),providerCalls:0,rows:0});
  }
}

console.log(JSON.stringify({capture:'EBAY_TAXONOMY',observedAt,summary,policy:{pathValidation:true,autoApproval:false,autoActivation:false,productRankingsCollected:false,purchaseAuthorized:false}}));
// Taxonomy capture is operational evidence and must not break unrelated production deploys.
process.exit(0);
