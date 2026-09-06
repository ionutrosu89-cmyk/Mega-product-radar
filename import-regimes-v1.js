export const IMPORT_REGIMES_V1=Object.freeze({
  B2B_STOCK_IMPORT:Object.freeze({
    code:'B2B_STOCK_IMPORT',
    label:'Business inventory import into Romania/EU',
    defaultForMpr:true,
    lowValueDistanceSaleFlatDutyApplicable:false,
    customsRule:'TARIC_CN_ORIGIN_REQUIRED',
    policy:'Seller imports stock into its business before resale. Do not apply consumer distance-sale low-value flat duty automatically.'
  }),
  EU_DISTANCE_SALE_LOW_VALUE:Object.freeze({
    code:'EU_DISTANCE_SALE_LOW_VALUE',
    label:'Distance sale imported directly to EU consumer',
    defaultForMpr:false,
    maxConsignmentValueEur:150,
    temporaryFlatDutyEurPerTariffItem:3,
    effectiveFrom:'2026-07-01',
    effectiveUntil:'2028-06-30',
    customsRule:'EU_TEMPORARY_LOW_VALUE_DISTANCE_SALE_DUTY',
    sourceUrl:'https://taxation-customs.ec.europa.eu/news/guidance-and-legal-text-temporary-flat-fee-low-value-imports-which-will-apply-until-1-july-2028-2026-06-08_en',
    policy:'Only for qualifying distance sales of imported goods. Never infer this regime merely from consignment value.'
  })
});

export function resolveImportRegime(code='B2B_STOCK_IMPORT'){
  return IMPORT_REGIMES_V1[String(code||'').toUpperCase()]||null;
}

export function customsTreatmentFor(input={}){
  const regime=resolveImportRegime(input.regimeCode||'B2B_STOCK_IMPORT');
  if(!regime)return {status:'UNKNOWN',blockers:['IMPORT_REGIME_UNKNOWN']};
  if(regime.code==='EU_DISTANCE_SALE_LOW_VALUE'){
    const value=Number(input.consignmentValueEur);
    if(!Number.isFinite(value)||value<0)return {status:'UNKNOWN',regime:regime.code,blockers:['CONSIGNMENT_VALUE_EUR_REQUIRED']};
    if(value>regime.maxConsignmentValueEur)return {status:'TARIC_REQUIRED',regime:regime.code,flatDutyEur:null,blockers:['CN_OR_TARIC_REQUIRED']};
    return {status:'FLAT_DISTANCE_SALE_DUTY',regime:regime.code,flatDutyEurPerTariffItem:3,blockers:[]};
  }
  return {status:'TARIC_REQUIRED',regime:regime.code,flatDutyEur:null,blockers:['CN_OR_TARIC_REQUIRED'],policy:'B2B stock import uses normal customs classification/origin logic. Do not auto-apply distance-sale flat duty.'};
}
