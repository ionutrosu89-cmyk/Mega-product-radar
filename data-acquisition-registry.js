// Mega Product Radar · Data Acquisition Registry V1
// Provider facts are planning metadata only. Paid execution is always fail-closed.

const finite=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const round=(v,d=4)=>{const x=finite(v);return x===null?null:Number(x.toFixed(d));};

export const DATA_PROVIDER_REGISTRY=Object.freeze({
  KEEPA:{
    label:'Keepa API',
    role:['AMAZON_CATALOGUE_DISCOVERY','PRODUCT_HISTORY','BEST_SELLERS','SELLER_CONTEXT'],
    commercialModel:'TOKEN_SUBSCRIPTION',
    paid:true,
    autoExecute:false,
    evidenceClass:'LICENSED_PROVIDER',
    pricingSnapshot:{observedAt:'2026-08-24',monthlyPriceEur:null,unitCostEur:null,source:'OFFICIAL_DOCS',note:'Plan price must be entered from the active Keepa account before authorization.'},
    tokenFacts:{productByAsin:1,productSearchPage:10,bestSellerList:50,bestSellerMaxAsins:100000,sellerLookup:1},
    recommendedPhase:'SEED_AND_HISTORY',
    status:'CANDIDATE'
  },
  DATAFORSEO_AMAZON_STANDARD:{
    label:'DataForSEO Merchant Amazon · Standard',
    role:['AMAZON_KEYWORD_DISCOVERY','ASIN_ENRICHMENT','SELLER_CONTEXT'],
    commercialModel:'PAY_AS_YOU_GO',
    paid:true,
    autoExecute:false,
    evidenceClass:'LICENSED_PROVIDER',
    pricingSnapshot:{observedAt:'2026-08-24',currency:'USD',billableUnitUsd:0.0015,source:'OFFICIAL_PRICING',note:'Cost applies to the provider billable product/SERP unit; planner must use explicit billable units, never inferred catalogue rows.'},
    recommendedPhase:'SEED_AND_GAP_FILL',
    status:'CANDIDATE'
  },
  SELLERSPRITE_ASIN_DETAILS:{
    label:'SellerSprite · ASIN Details API',
    role:['ASIN_ENRICHMENT'],
    commercialModel:'MONTHLY_QUOTA',
    paid:true,
    autoExecute:false,
    evidenceClass:'LICENSED_PROVIDER',
    pricingSnapshot:{observedAt:'2026-08-24',monthlyPriceUsd:149,requestsPerMonth:50000,source:'OFFICIAL_PRICING'},
    recommendedPhase:'LATER_VALIDATION',
    status:'DEFER_FOR_BUDGET'
  },
  SELLERSPRITE_SALES_ESTIMATOR:{
    label:'SellerSprite · ASIN Sales Estimator API',
    role:['SALES_ESTIMATION'],
    commercialModel:'MONTHLY_QUOTA',
    paid:true,
    autoExecute:false,
    evidenceClass:'LICENSED_PROVIDER',
    pricingSnapshot:{observedAt:'2026-08-24',monthlyPriceUsd:799,requestsPerMonth:40000,source:'OFFICIAL_PRICING'},
    recommendedPhase:'LATER_VALIDATION',
    status:'DEFER_FOR_BUDGET'
  },
  EMAG_PUBLIC:{
    label:'eMAG public evidence',
    role:['ROMANIA_MARKET_CONTEXT'],
    commercialModel:'PUBLIC_EVIDENCE',
    paid:false,
    autoExecute:false,
    evidenceClass:'PUBLIC_OBSERVATION',
    pricingSnapshot:{observedAt:'2026-08-24',source:'PUBLIC'},
    recommendedPhase:'ROMANIA_CONTEXT',
    status:'MANUAL_OR_COMPLIANT_CONNECTOR_ONLY'
  },
  MANUAL_RESEARCH:{
    label:'Manual research',
    role:['QUALITY_CONTROL','SOURCE_VERIFICATION'],
    commercialModel:'MANUAL',
    paid:false,
    autoExecute:false,
    evidenceClass:'MANUAL_EVIDENCE',
    pricingSnapshot:{observedAt:'2026-08-24',source:'INTERNAL'},
    recommendedPhase:'ALL_PHASES',
    status:'ACTIVE'
  }
});

export function providerFor(key){return DATA_PROVIDER_REGISTRY[String(key||'').toUpperCase()]||null;}

export function estimateProviderCost(key,{billableUnits=null,fxUsdEur=null,monthlyPriceOverrideEur=null}={}){
  const p=providerFor(key);
  if(!p)return{status:'UNKNOWN_PROVIDER',costEur:null};
  if(!p.paid)return{status:'ZERO_PROVIDER_FEE',costEur:0};
  if(p.commercialModel==='TOKEN_SUBSCRIPTION'){
    const monthly=finite(monthlyPriceOverrideEur??p.pricingSnapshot?.monthlyPriceEur);
    return monthly===null?{status:'PRICE_CONFIGURATION_REQUIRED',costEur:null}:{status:'ESTIMATED_MONTHLY_SUBSCRIPTION',costEur:round(monthly,2)};
  }
  if(p.commercialModel==='PAY_AS_YOU_GO'){
    const units=finite(billableUnits),unitUsd=finite(p.pricingSnapshot?.billableUnitUsd),fx=finite(fxUsdEur);
    if(units===null||units<0)return{status:'BILLABLE_UNITS_REQUIRED',costEur:null};
    if(unitUsd===null)return{status:'UNIT_PRICE_UNAVAILABLE',costEur:null};
    if(fx===null||fx<=0)return{status:'FX_REQUIRED',costEur:null,costUsd:round(units*unitUsd,4)};
    return{status:'ESTIMATED_PAYG',costUsd:round(units*unitUsd,4),costEur:round(units*unitUsd*fx,4)};
  }
  if(p.commercialModel==='MONTHLY_QUOTA'){
    const usd=finite(p.pricingSnapshot?.monthlyPriceUsd),fx=finite(fxUsdEur);
    if(usd===null)return{status:'PRICE_CONFIGURATION_REQUIRED',costEur:null};
    if(fx===null||fx<=0)return{status:'FX_REQUIRED',costUsd:usd,costEur:null};
    return{status:'ESTIMATED_MONTHLY_SUBSCRIPTION',costUsd:usd,costEur:round(usd*fx,2)};
  }
  return{status:'COST_MODEL_UNSUPPORTED',costEur:null};
}

export function authorizeAcquisitionRun(key,{explicitApproval=false,budgetRemainingEur=0,...costInputs}={}){
  const p=providerFor(key);
  if(!p)return{authorized:false,reason:'UNKNOWN_PROVIDER',executeAutomatically:false};
  if(p.autoExecute===true)return{authorized:false,reason:'REGISTRY_POLICY_VIOLATION',executeAutomatically:false};
  if(!p.paid)return{authorized:true,reason:'ZERO_PROVIDER_FEE_PLANNING_ALLOWED',executeAutomatically:false};
  if(!explicitApproval)return{authorized:false,reason:'EXPLICIT_PAID_APPROVAL_REQUIRED',executeAutomatically:false};
  const estimate=estimateProviderCost(key,costInputs);
  if(estimate.costEur===null)return{authorized:false,reason:estimate.status,cost:estimate,executeAutomatically:false};
  const remaining=finite(budgetRemainingEur);
  if(remaining===null||remaining<estimate.costEur)return{authorized:false,reason:'BUDGET_INSUFFICIENT',cost:estimate,executeAutomatically:false};
  return{authorized:true,reason:'APPROVED_WITHIN_EXPLICIT_BUDGET',cost:estimate,executeAutomatically:false};
}

export function acquisitionRecommendation({targetProducts=10000,currentProducts=0}={}){
  const target=Math.max(0,finite(targetProducts)??0),current=Math.max(0,finite(currentProducts)??0),gap=Math.max(0,target-current);
  return {
    targetProducts:target,
    currentProducts:current,
    productGap:gap,
    seedOrder:[
      {provider:'KEEPA',purpose:'Broad Amazon catalogue discovery + history',status:'EVALUATE_ACTIVE_PLAN_PRICE_FIRST'},
      {provider:'DATAFORSEO_AMAZON_STANDARD',purpose:'Keyword/category gap filling and structured Amazon rows',status:'PAYG_FALLBACK_OR_COMPLEMENT'},
      {provider:'EMAG_PUBLIC',purpose:'Romania market context only',status:'DO_NOT_USE_AS_MASS_SCRAPE'},
      {provider:'SELLERSPRITE_ASIN_DETAILS',purpose:'Later enrichment if evidence gain justifies subscription',status:'DEFER'},
      {provider:'SELLERSPRITE_SALES_ESTIMATOR',purpose:'Later high-value sales estimation',status:'DEFER'}
    ],
    policy:'ACQUIRE_BREADTH_FIRST_ENRICH_HIGH_INFORMATION_VALUE_LATER',
    paidRunAuthorized:false,
    purchaseAuthorized:false
  };
}
