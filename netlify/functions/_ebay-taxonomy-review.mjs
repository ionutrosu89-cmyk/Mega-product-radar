import {EBAY_BUY_AUTH,getEbayApplicationToken,ebayBuyAccessState} from './_ebay-buy-auth.mjs';
import {FREE_TOP25_EXPANDED_REGISTRY} from '../../free-top25-expanded-registry.js';

const TAXONOMY_URL='https://api.ebay.com/commerce/taxonomy/v1';
const SUPPORTED_MARKETPLACES=new Set(['EBAY_US','EBAY_DE']);
const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const fold=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

const COVERAGE_TERMS=Object.freeze({
  EBAY_US:{CASA:['home garden'],AUTO:['automotive'],ELECTRONICE:['consumer electronics'],BEAUTY:['health beauty'],PET:['pet supplies'],SPORT:['sporting goods'],COPII:['toys hobbies'],BIROU:['office'],ORGANIZARE_CASA:['home organization'],CURATENIE:['cleaning'],TELEFON_TECH:['cell phones accessories'],FITNESS_ACASA:['fitness'],GRADINA_BALCON:['garden outdoor'],DIY_SCULE:['tools workshop equipment'],BABY_ACCESORII:['baby'],AUTO_ACCESORII:['car accessories'],HOBBY_CRAFT:['crafts'],PARTY:['party supplies'],BIROU_ORGANIZARE:['office organization'],FASHION_ORGANIZARE:['clothing organization'],CAINI_ACCESORII:['dog supplies'],PISICI_ACCESORII:['cat supplies'],LAUNDRY:['laundry'],COPII_EDUCATIONAL:['educational toys'],CALATORII:['travel luggage']},
  EBAY_DE:{CASA:['haus garten'],AUTO:['auto motorrad'],ELECTRONICE:['elektronik'],BEAUTY:['beauty gesundheit'],PET:['tierbedarf'],SPORT:['sport'],COPII:['spielzeug'],BIROU:['büro'],ORGANIZARE_CASA:['aufbewahrung organisation'],CURATENIE:['reinigung'],TELEFON_TECH:['handy zubehör'],FITNESS_ACASA:['fitness'],GRADINA_BALCON:['garten'],DIY_SCULE:['werkzeuge'],BABY_ACCESORII:['baby'],AUTO_ACCESORII:['auto zubehör'],HOBBY_CRAFT:['basteln'],PARTY:['party'],BIROU_ORGANIZARE:['büro organisation'],FASHION_ORGANIZARE:['kleidung aufbewahrung'],CAINI_ACCESORII:['hund zubehör'],PISICI_ACCESORII:['katze zubehör'],LAUNDRY:['wäsche'],COPII_EDUCATIONAL:['lernspielzeug'],CALATORII:['reise gepäck']}
});

export function normalizeCategorySuggestions(payload,{marketplaceId,query}={}){
  const rows=Array.isArray(payload?.categorySuggestions)?payload.categorySuggestions:[];
  return rows.slice(0,10).flatMap((row,index)=>{
    const categoryId=clean(row?.category?.categoryId);
    const categoryName=clean(row?.category?.categoryName).slice(0,180);
    if(!/^\d+$/.test(categoryId)||!categoryName)return [];
    const ancestors=Array.isArray(row?.categoryTreeNodeAncestors)?row.categoryTreeNodeAncestors.flatMap(item=>{
      const id=clean(item?.categoryId); const name=clean(item?.categoryName).slice(0,180);
      return /^\d+$/.test(id)&&name?[{categoryId:id,categoryName:name}]:[];
    }):[];
    return [{marketplaceId,query,suggestionRank:index+1,categoryId,categoryName,ancestors,reviewState:'REVIEW_REQUIRED',activationEligible:false,evidenceClass:'EBAY_TAXONOMY_SUGGESTION',sourceLabel:'eBay Taxonomy API'}];
  });
}

export async function getEbayCategorySuggestions({query,marketplaceId='EBAY_US',env=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
  const q=clean(query).slice(0,120); const market=upper(marketplaceId);
  if(ebayBuyAccessState(env)!=='READY_TO_COLLECT')return {ok:false,code:'EBAY_ACCESS_NOT_READY',providerCalls:0,suggestions:[]};
  if(q.length<2)return {ok:false,code:'QUERY_REQUIRED',providerCalls:0,suggestions:[]};
  if(!SUPPORTED_MARKETPLACES.has(market))return {ok:false,code:'MARKETPLACE_UNSUPPORTED',providerCalls:0,suggestions:[]};
  const token=await getEbayApplicationToken({env,fetchImpl,now,scope:EBAY_BUY_AUTH.taxonomyScope});
  const treeUrl=new URL(`${TAXONOMY_URL}/get_default_category_tree_id`); treeUrl.searchParams.set('marketplace_id',market);
  const treeResponse=await fetchImpl(treeUrl,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(!treeResponse.ok)return {ok:false,code:`EBAY_TAXONOMY_TREE_HTTP_${treeResponse.status}`,providerCalls:1,suggestions:[]};
  const tree=await treeResponse.json(); const treeId=clean(tree?.categoryTreeId); const treeVersion=clean(tree?.categoryTreeVersion);
  if(!/^\d+$/.test(treeId))return {ok:false,code:'EBAY_TAXONOMY_TREE_INVALID',providerCalls:1,suggestions:[]};
  const suggestionUrl=new URL(`${TAXONOMY_URL}/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions`); suggestionUrl.searchParams.set('q',q);
  const response=await fetchImpl(suggestionUrl,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(!response.ok)return {ok:false,code:`EBAY_TAXONOMY_SUGGEST_HTTP_${response.status}`,providerCalls:2,suggestions:[]};
  const payload=await response.json(); const suggestions=normalizeCategorySuggestions(payload,{marketplaceId:market,query:q});
  return {ok:suggestions.length>0,code:suggestions.length?'REVIEW_REQUIRED':'NO_SUGGESTIONS',providerCalls:2,marketplaceId:market,query:q,categoryTreeId:treeId,categoryTreeVersion:treeVersion,suggestions,policy:{autoApproval:false,autoActivation:false}};
}

function flattenTree(node,path=[],rows=[]){
  if(!node||typeof node!=='object')return rows;
  const categoryId=clean(node?.category?.categoryId); const categoryName=clean(node?.category?.categoryName);
  const next=categoryId&&categoryName?[...path,{categoryId,categoryName}]:path;
  if(categoryId&&categoryName)rows.push({categoryId,categoryName,leaf:Boolean(node.leafCategoryTreeNode),level:Math.max(0,next.length-1),path:next});
  for(const child of Array.isArray(node.childCategoryTreeNodes)?node.childCategoryTreeNodes:[])flattenTree(child,next,rows);
  return rows;
}
function relevance(name,terms){
  const n=fold(name); if(!n)return 0;
  let best=0;
  for(const raw of terms){const q=fold(raw); if(!q)continue; if(n===q)best=Math.max(best,100); else if(n.includes(q)||q.includes(n))best=Math.max(best,75); else {const qt=new Set(q.split(' ').filter(Boolean)); const nt=new Set(n.split(' ').filter(Boolean)); const overlap=[...qt].filter(t=>nt.has(t)).length; if(overlap)best=Math.max(best,Math.round(50*overlap/Math.max(qt.size,nt.size)));}}
  return best;
}
export function buildCategoryCoverageReview({marketplaceId,treeId,treeVersion,rootCategoryNode,termsByNiche}={}){
  const market=upper(marketplaceId); const nodes=flattenTree(rootCategoryNode); const configured=termsByNiche&&typeof termsByNiche==='object'?termsByNiche:COVERAGE_TERMS[market]||{};
  const targets=FREE_TOP25_EXPANDED_REGISTRY.map(niche=>{
    const terms=(Array.isArray(configured[niche.id])?configured[niche.id]:[niche.label]).map(clean).filter(Boolean).slice(0,8);
    const candidates=nodes.map(node=>({...node,reviewScore:relevance(node.categoryName,terms)})).filter(node=>node.reviewScore>0).sort((a,b)=>b.reviewScore-a.reviewScore||a.level-b.level||a.categoryId.localeCompare(b.categoryId)).slice(0,8).map((node,index)=>({candidateRank:index+1,categoryId:node.categoryId,categoryName:node.categoryName,leaf:node.leaf,level:node.level,path:node.path,reviewScore:node.reviewScore,evidenceClass:'EBAY_CATEGORY_TREE_REVIEW_CANDIDATE',activationEligible:false}));
    return {nicheId:niche.id,nicheLabel:niche.label,marketplaceId:market,searchTerms:terms,reviewState:candidates.length?'REVIEW_REQUIRED':'NEEDS_NICHE_REFINEMENT',activationEligible:false,candidates};
  });
  return {marketplaceId:market,categoryTreeId:clean(treeId),categoryTreeVersion:clean(treeVersion),targetCount:targets.length,reviewRequiredCount:targets.filter(t=>t.reviewState==='REVIEW_REQUIRED').length,targets,policy:{autoApproval:false,autoActivation:false,syntheticProductRanking:false,humanSemanticScopeApprovalRequired:true}};
}
export async function getEbayCategoryCoverageReview({marketplaceId='EBAY_US',termsByNiche,env=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
  const market=upper(marketplaceId);
  if(ebayBuyAccessState(env)!=='READY_TO_COLLECT')return {ok:false,code:'EBAY_ACCESS_NOT_READY',providerCalls:0,targets:[]};
  if(!SUPPORTED_MARKETPLACES.has(market))return {ok:false,code:'MARKETPLACE_UNSUPPORTED',providerCalls:0,targets:[]};
  const token=await getEbayApplicationToken({env,fetchImpl,now,scope:EBAY_BUY_AUTH.taxonomyScope});
  const treeIdUrl=new URL(`${TAXONOMY_URL}/get_default_category_tree_id`); treeIdUrl.searchParams.set('marketplace_id',market);
  const idResponse=await fetchImpl(treeIdUrl,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(!idResponse.ok)return {ok:false,code:`EBAY_TAXONOMY_TREE_HTTP_${idResponse.status}`,providerCalls:1,targets:[]};
  const meta=await idResponse.json(); const treeId=clean(meta?.categoryTreeId); const treeVersion=clean(meta?.categoryTreeVersion);
  if(!/^\d+$/.test(treeId))return {ok:false,code:'EBAY_TAXONOMY_TREE_INVALID',providerCalls:1,targets:[]};
  const treeResponse=await fetchImpl(`${TAXONOMY_URL}/category_tree/${encodeURIComponent(treeId)}`,{headers:{authorization:`Bearer ${token}`,accept:'application/json','accept-encoding':'gzip'}});
  if(!treeResponse.ok)return {ok:false,code:`EBAY_TAXONOMY_FULL_TREE_HTTP_${treeResponse.status}`,providerCalls:2,targets:[]};
  const tree=await treeResponse.json(); const review=buildCategoryCoverageReview({marketplaceId:market,treeId,treeVersion:clean(tree?.categoryTreeVersion)||treeVersion,rootCategoryNode:tree?.rootCategoryNode,termsByNiche});
  return {ok:true,code:'REVIEW_REQUIRED',providerCalls:2,...review};
}

export const EBAY_TAXONOMY_REVIEW={baseUrl:TAXONOMY_URL,supportedMarketplaces:[...SUPPORTED_MARKETPLACES],maxSuggestions:10,autoApproval:false,coverageTargetCount:FREE_TOP25_EXPANDED_REGISTRY.length};
