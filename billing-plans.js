export const SAAS_PLANS=Object.freeze({
  STARTER:{code:'STARTER',name:'Starter',monthlyPriceEur:19,scanCredits:30,workspaces:1,teamSeats:1,features:['RADAR','DISCOVERY','LANDED_COST']},
  PRO:{code:'PRO',name:'Pro',monthlyPriceEur:39,scanCredits:120,workspaces:2,teamSeats:3,features:['RADAR','DISCOVERY','LANDED_COST','SUPPLIERS','PURCHASE','PORTFOLIO','ALERTS']},
  BUSINESS:{code:'BUSINESS',name:'Business',monthlyPriceEur:79,scanCredits:400,workspaces:5,teamSeats:10,features:['RADAR','DISCOVERY','LANDED_COST','SUPPLIERS','PURCHASE','PORTFOLIO','ALERTS','EXPORT','TEAM']}
});
export function planByCode(code='STARTER'){return SAAS_PLANS[String(code).toUpperCase()]||SAAS_PLANS.STARTER;}
export function hasFeature(plan,feature){return planByCode(plan).features.includes(String(feature).toUpperCase());}
export function usageRemaining(plan,used=0){return Math.max(0,planByCode(plan).scanCredits-Math.max(0,Number(used)||0));}
