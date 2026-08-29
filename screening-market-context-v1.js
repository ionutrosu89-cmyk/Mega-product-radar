const clean=v=>String(v??'').trim().toUpperCase();

export function validateScreeningMarketContext(input={}){
  const blockers=[];
  const marketplaceMarket=clean(input.marketplaceMarket);
  const targetSellMarket=clean(input.targetSellMarket);
  const taxJurisdiction=clean(input.taxJurisdiction);
  const marketplaceFeeMarket=clean(input.marketplaceFeeMarket);

  if(!marketplaceMarket)blockers.push('MARKETPLACE_MARKET_REQUIRED');
  if(!targetSellMarket)blockers.push('TARGET_SELL_MARKET_REQUIRED');
  if(!taxJurisdiction)blockers.push('TAX_JURISDICTION_REQUIRED');
  if(!marketplaceFeeMarket)blockers.push('MARKETPLACE_FEE_MARKET_REQUIRED');

  if(marketplaceMarket&&targetSellMarket&&marketplaceMarket!==targetSellMarket)blockers.push('SELL_PRICE_MARKET_MISMATCH');
  if(targetSellMarket&&taxJurisdiction&&targetSellMarket!==taxJurisdiction)blockers.push('SELL_TAX_JURISDICTION_MISMATCH');
  if(marketplaceMarket&&marketplaceFeeMarket&&marketplaceMarket!==marketplaceFeeMarket)blockers.push('MARKETPLACE_FEE_MARKET_MISMATCH');

  return {
    schemaVersion:'MPR_SCREENING_MARKET_CONTEXT_V1',
    status:blockers.length?'BLOCKED':'COHERENT',
    blockers:[...new Set(blockers)],
    marketplaceMarket:marketplaceMarket||null,
    targetSellMarket:targetSellMarket||null,
    taxJurisdiction:taxJurisdiction||null,
    marketplaceFeeMarket:marketplaceFeeMarket||null,
    truthPolicy:{crossMarketPriceIsNotLocalSellPrice:true,unknownEqualsMatch:false,unknownEqualsZero:false}
  };
}
