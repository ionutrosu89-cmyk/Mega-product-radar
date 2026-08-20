export const SAAS_PLANS=Object.freeze({
  FREE:{code:'FREE',name:'Free',monthlyPriceEur:0,scanCredits:3,workspaces:1,teamSeats:1,features:['DISCOVERY','TOP_PRODUCTS_LIMITED']},
  DISCOVER:{code:'DISCOVER',name:'Discover',monthlyPriceEur:17.9,scanCredits:100,workspaces:1,teamSeats:1,features:['DISCOVERY','TOP_PRODUCTS','TRENDING','RISING','HISTORY','FILTERS','ALERTS']},
  RADAR:{code:'RADAR',name:'Radar',monthlyPriceEur:29,scanCredits:300,workspaces:1,teamSeats:1,features:['DISCOVERY','TOP_PRODUCTS','TRENDING','RISING','HISTORY','FILTERS','ALERTS','RADAR','ROMANIA_GAP','SUPPLIERS','LANDED_COST','PROFIT','IMPORT_RISK','DECISION_GATE','WATCHLIST']},
  LAUNCH:{code:'LAUNCH',name:'Launch',monthlyPriceEur:89,scanCredits:1000,workspaces:2,teamSeats:2,features:['DISCOVERY','TOP_PRODUCTS','TRENDING','RISING','HISTORY','FILTERS','ALERTS','RADAR','ROMANIA_GAP','SUPPLIERS','LANDED_COST','PROFIT','IMPORT_RISK','DECISION_GATE','WATCHLIST','PERSONALIZED_SHORTLIST','BUDGET_PLAN','LAUNCH_PLAN','PURCHASE','PORTFOLIO','EXPORT']}
});

const LEGACY_PLAN_ALIASES=Object.freeze({STARTER:'DISCOVER',PRO:'RADAR',BUSINESS:'LAUNCH'});

export function planByCode(code='FREE'){
  const normalized=String(code||'FREE').toUpperCase();
  return SAAS_PLANS[LEGACY_PLAN_ALIASES[normalized]||normalized]||SAAS_PLANS.FREE;
}
export function hasFeature(plan,feature){return planByCode(plan).features.includes(String(feature).toUpperCase());}
export function usageRemaining(plan,used=0){return Math.max(0,planByCode(plan).scanCredits-Math.max(0,Number(used)||0));}
