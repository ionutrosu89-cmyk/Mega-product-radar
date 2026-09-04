export function buildOpportunityDashboardDataset(rows=[]){
  const normalized=(Array.isArray(rows)?rows:[]).map((row,index)=>({
    id:String(row.id??row.canonicalProductId??index),
    canonicalProductId:row.canonicalProductId??null,
    title:row.title??null,
    category:row.category??null,
    marketplace:row.marketplace??null,
    supplierSource:row.supplierSource??null,
    marketplacePrice:row.marketplacePrice??null,
    supplierPublicPrice:row.supplierPublicPrice??null,
    conservativeLandedCost:row.economics?.scenarios?.conservative?.landedCostPerUnitRon??null,
    best:row.economics?.scenarios?.best??null,
    base:row.economics?.scenarios?.base??null,
    conservative:row.economics?.scenarios?.conservative??null,
    matchConfidence:row.matchConfidence??null,
    opportunityScore:row.score?.opportunityScore??row.opportunityScore??null,
    confidenceScore:row.score?.confidenceScore??row.confidenceScore??null,
    blockers:row.score?.blockers??row.blockers??[],
    sourceLinks:Array.isArray(row.sourceLinks)?row.sourceLinks:[],
    freshness:row.freshness??null,
    action:row.action??'WATCH'
  }));
  const sorted=[...normalized].sort((a,b)=>(b.opportunityScore??-1)-(a.opportunityScore??-1)||(b.confidenceScore??-1)-(a.confidenceScore??-1));
  return {schemaVersion:'MPR_OPPORTUNITY_DASHBOARD_DATASET_V1',rows:sorted,top100:sorted.slice(0,100),top20:sorted.slice(0,20),allowedActions:['IGNORE','WATCH','SHORTLIST'],filters:['roi','netMargin','profitPerUnitRon','category','marketplace','supplierSource','matchConfidence','confidenceScore'],truthPolicy:{baseEconomicsIncludesNegotiation:false,purchaseAuthorized:false}};
}
