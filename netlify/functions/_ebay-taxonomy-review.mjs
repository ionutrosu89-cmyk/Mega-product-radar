import {EBAY_BUY_AUTH,getEbayApplicationToken,ebayBuyAccessState} from './_ebay-buy-auth.mjs';

const TAXONOMY_URL='https://api.ebay.com/commerce/taxonomy/v1';
const SUPPORTED_MARKETPLACES=new Set(['EBAY_US','EBAY_DE']);
const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export function normalizeCategorySuggestions(payload,{marketplaceId,query}={}){
  const rows=Array.isArray(payload?.categorySuggestions)?payload.categorySuggestions:[];
  return rows.slice(0,10).flatMap((row,index)=>{
    const categoryId=clean(row?.category?.categoryId);
    const categoryName=clean(row?.category?.categoryName).slice(0,180);
    if(!/^\d+$/.test(categoryId)||!categoryName)return [];
    const ancestors=Array.isArray(row?.categoryTreeNodeAncestors)?row.categoryTreeNodeAncestors.flatMap(item=>{
      const id=clean(item?.categoryId);
      const name=clean(item?.categoryName).slice(0,180);
      return /^\d+$/.test(id)&&name?[{categoryId:id,categoryName:name}]:[];
    }):[];
    return [{
      marketplaceId,
      query,
      suggestionRank:index+1,
      categoryId,
      categoryName,
      ancestors,
      reviewState:'REVIEW_REQUIRED',
      activationEligible:false,
      evidenceClass:'EBAY_TAXONOMY_SUGGESTION',
      sourceLabel:'eBay Taxonomy API'
    }];
  });
}

export async function getEbayCategorySuggestions({query,marketplaceId='EBAY_US',env=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
  const q=clean(query).slice(0,120);
  const market=upper(marketplaceId);
  if(ebayBuyAccessState(env)!=='READY_TO_COLLECT')return {ok:false,code:'EBAY_ACCESS_NOT_READY',providerCalls:0,suggestions:[]};
  if(q.length<2)return {ok:false,code:'QUERY_REQUIRED',providerCalls:0,suggestions:[]};
  if(!SUPPORTED_MARKETPLACES.has(market))return {ok:false,code:'MARKETPLACE_UNSUPPORTED',providerCalls:0,suggestions:[]};

  const token=await getEbayApplicationToken({env,fetchImpl,now,scope:EBAY_BUY_AUTH.taxonomyScope});
  const treeUrl=new URL(`${TAXONOMY_URL}/get_default_category_tree_id`);
  treeUrl.searchParams.set('marketplace_id',market);
  const treeResponse=await fetchImpl(treeUrl,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(!treeResponse.ok)return {ok:false,code:`EBAY_TAXONOMY_TREE_HTTP_${treeResponse.status}`,providerCalls:1,suggestions:[]};
  const tree=await treeResponse.json();
  const treeId=clean(tree?.categoryTreeId);
  const treeVersion=clean(tree?.categoryTreeVersion);
  if(!/^\d+$/.test(treeId))return {ok:false,code:'EBAY_TAXONOMY_TREE_INVALID',providerCalls:1,suggestions:[]};

  const suggestionUrl=new URL(`${TAXONOMY_URL}/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions`);
  suggestionUrl.searchParams.set('q',q);
  const response=await fetchImpl(suggestionUrl,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(!response.ok)return {ok:false,code:`EBAY_TAXONOMY_SUGGEST_HTTP_${response.status}`,providerCalls:2,suggestions:[]};
  const payload=await response.json();
  const suggestions=normalizeCategorySuggestions(payload,{marketplaceId:market,query:q});
  return {ok:suggestions.length>0,code:suggestions.length?'REVIEW_REQUIRED':'NO_SUGGESTIONS',providerCalls:2,marketplaceId:market,query:q,categoryTreeId:treeId,categoryTreeVersion:treeVersion,suggestions,policy:{autoApproval:false,autoActivation:false}};
}

export const EBAY_TAXONOMY_REVIEW={baseUrl:TAXONOMY_URL,supportedMarketplaces:[...SUPPORTED_MARKETPLACES],maxSuggestions:10,autoApproval:false};
