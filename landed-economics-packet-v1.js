const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const positive = v => finite(v) && Number(v) > 0;
const nonNegative = v => finite(v) && Number(v) >= 0;

export function buildLandedEconomicsPacket(input = {}) {
  const blockers = [];
  const supplierVerified = input.supplierEvidenceLevel === 'MANUALLY_VERIFIED';
  if (!supplierVerified) blockers.push('SUPPLIER_NOT_MANUALLY_VERIFIED');

  const required = [
    ['LANDED_UNIT_COST', input.landedUnitCost],
    ['SELL_PRICE', input.sellPrice],
    ['MARKETPLACE_COMMISSION_RATE', input.marketplaceCommissionRate],
    ['VAT_RATE', input.vatRate],
    ['ADS_RATE', input.adsRate],
    ['RETURNS_RESERVE_RATE', input.returnsReserveRate],
    ['FULFILMENT_COST_PER_UNIT', input.fulfilmentCostPerUnit],
  ];
  for (const [code, value] of required) if (!nonNegative(value)) blockers.push(`${code}_UNKNOWN`);

  if (input.currency && input.baseCurrency && input.currency !== input.baseCurrency) {
    if (!positive(input.fxRate)) blockers.push('FX_RATE_UNKNOWN');
    if (!input.fxSource) blockers.push('FX_SOURCE_UNKNOWN');
  }
  if (!input.landedCostEvidenceRef) blockers.push('LANDED_COST_EVIDENCE_REF_MISSING');
  if (!input.sellPriceEvidenceRef) blockers.push('SELL_PRICE_EVIDENCE_REF_MISSING');

  const confirmed = blockers.length === 0;
  if (!confirmed) {
    return {
      version:'1.0', status:'BLOCKED', confirmed:false, blockers,
      profitPerUnit:null, marginPct:null, roiPct:null, breakEvenUnits:null,
      purchaseAuthorized:false
    };
  }

  const landed = Number(input.landedUnitCost);
  const sell = Number(input.sellPrice);
  const commission = sell * Number(input.marketplaceCommissionRate);
  const vat = sell * Number(input.vatRate);
  const ads = sell * Number(input.adsRate);
  const returnsReserve = sell * Number(input.returnsReserveRate);
  const fulfilment = Number(input.fulfilmentCostPerUnit);
  const totalVariableCost = landed + commission + vat + ads + returnsReserve + fulfilment;
  const profitPerUnit = sell - totalVariableCost;
  const marginPct = sell > 0 ? (profitPerUnit / sell) * 100 : null;
  const roiPct = landed > 0 ? (profitPerUnit / landed) * 100 : null;
  const fixedTestCost = nonNegative(input.fixedTestCost) ? Number(input.fixedTestCost) : 0;
  const breakEvenUnits = profitPerUnit > 0 ? Math.ceil(fixedTestCost / profitPerUnit) : null;

  return {
    version:'1.0', status:'CONFIRMED', confirmed:true, blockers:[],
    currency: input.baseCurrency || input.currency || null,
    economics:{landedUnitCost:landed,sellPrice:sell,commission,vat,ads,returnsReserve,fulfilment,totalVariableCost,profitPerUnit,marginPct,roiPct,breakEvenUnits},
    evidence:{landedCostEvidenceRef:input.landedCostEvidenceRef,sellPriceEvidenceRef:input.sellPriceEvidenceRef,fxSource:input.fxSource ?? null,fxRate:input.fxRate ?? null},
    purchaseAuthorized:false
  };
}
