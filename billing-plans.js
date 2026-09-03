export const SAAS_PLANS=Object.freeze({
  FREE:{
    code:'FREE',name:'Free',monthlyPriceEur:0,scanCredits:3,workspaces:1,teamSeats:1,
    features:['DISCOVERY','FREE_TOP25','TOP_PRODUCTS_LIMITED','CATEGORY_UNIVERSE','CATEGORY_TOP_PRODUCTS','SELLER_BRAND_INTELLIGENCE','MARKET_HISTORY_BASIC']
  },
  DISCOVER:{
    code:'DISCOVER',name:'Discover',monthlyPriceEur:17.9,scanCredits:100,workspaces:1,teamSeats:1,
    features:['DISCOVERY','FREE_TOP25','TOP_PRODUCTS_LIMITED','CATEGORY_UNIVERSE','CATEGORY_TOP_PRODUCTS','TOP_PRODUCTS','SELLER_BRAND_INTELLIGENCE','MARKET_HISTORY_BASIC','TRENDING','RISING','HISTORY','FILTERS','ALERTS']
  },
  RADAR:{
    code:'RADAR',name:'Radar',monthlyPriceEur:29,scanCredits:300,workspaces:1,teamSeats:1,
    features:['DISCOVERY','FREE_TOP25','TOP_PRODUCTS_LIMITED','CATEGORY_UNIVERSE','CATEGORY_TOP_PRODUCTS','TOP_PRODUCTS','SELLER_BRAND_INTELLIGENCE','MARKET_HISTORY_BASIC','TRENDING','RISING','HISTORY','FILTERS','ALERTS','RADAR','ROMANIA_GAP','IMPORT_RISK','OPPORTUNITY_ENGINE','DECISION_GATE','WATCHLIST']
  },
  LAUNCH:{
    code:'LAUNCH',name:'Launch',monthlyPriceEur:89,scanCredits:1000,workspaces:2,teamSeats:2,
    features:['DISCOVERY','FREE_TOP25','TOP_PRODUCTS_LIMITED','CATEGORY_UNIVERSE','CATEGORY_TOP_PRODUCTS','TOP_PRODUCTS','SELLER_BRAND_INTELLIGENCE','MARKET_HISTORY_BASIC','SUPPLIERS','SUPPLIER_BENCHMARK','LANDED_COST','PROFIT','IMPORT_RISK','ECONOMICS','RADAR','TRENDING','RISING','HISTORY','FILTERS','ALERTS','ROMANIA_GAP','OPPORTUNITY_ENGINE','DECISION_GATE','WATCHLIST','ACADEMY','PARTNER_NETWORK','PERSONALIZED_SHORTLIST','BUDGET_PLAN','LAUNCH_PLAN','PURCHASE','PORTFOLIO','EXPORT']
  }
});

const LEGACY_PLAN_ALIASES=Object.freeze({STARTER:'DISCOVER',PRO:'RADAR',BUSINESS:'LAUNCH'});

export function planByCode(code='FREE'){
  const normalized=String(code||'FREE').toUpperCase();
  return SAAS_PLANS[LEGACY_PLAN_ALIASES[normalized]||normalized]||SAAS_PLANS.FREE;
}
export function hasFeature(plan,feature){return planByCode(plan).features.includes(String(feature).toUpperCase());}
export function usageRemaining(plan,used=0){return Math.max(0,planByCode(plan).scanCredits-Math.max(0,Number(used)||0));}
