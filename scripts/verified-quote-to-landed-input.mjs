import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {activeMarketProfile} from '../market-profiles-v1.js';

function text(v){return String(v??'').trim();}
function numeric(v){return v!==null&&v!==undefined&&!(typeof v==='string'&&v.trim()==='')&&Number.isFinite(Number(v));}

function evidenceMode(source={}){
  if(source?.verified===true&&source?.evidenceStatus==='MANUALLY_VERIFIED_QUOTE')return 'VERIFIED_QUOTE';
  if(source?.evidenceStatus==='SUPPLIER_PAGE_OBSERVED'||source?.supplierPageObserved===true)return 'SUPPLIER_PAGE';
  return 'UNKNOWN';
}

export function buildLandedInputFromVerifiedQuote(source={}){
  const market=activeMarketProfile();
  const blockers=[];
  const mode=evidenceMode(source);

  if(mode==='UNKNOWN')blockers.push('evidence must be a manually verified quote or an exact observed supplier product page');
  if(!text(source.productCanonicalKey))blockers.push('product identity missing');
  if(!text(source.supplierName))blockers.push('supplier identity missing');
  if(!text(source.sourceUrl))blockers.push('direct supplier product-page or quote source URL missing');
  if(!numeric(source.unitPrice)||Number(source.unitPrice)<=0)blockers.push('usable unit price missing');
  if(!text(source.currency))blockers.push('price currency missing');

  const qty = numeric(source.quoteQuantity)&&Number(source.quoteQuantity)>0
    ? Number(source.quoteQuantity)
    : numeric(source.moq)&&Number(source.moq)>0
      ? Number(source.moq)
      : null;
  if(!qty)blockers.push('usable quote quantity or displayed MOQ missing');

  if(mode==='VERIFIED_QUOTE'){
    if(source?.landedCostEligible!==true)blockers.push('quote is not landed-cost eligible');
    if(!numeric(source.bulkShippingToRomania)||Number(source.bulkShippingToRomania)<0)blockers.push('verified Romania shipping missing');
    if(!text(source.shippingCurrency))blockers.push('shipping currency missing');
    if(text(source.shippingCurrency).toUpperCase()!==text(source.currency).toUpperCase())blockers.push('mixed currencies require explicit conversion before landed-cost input');
  }

  if(blockers.length)return {ready:false,status:'BLOCKED_INSUFFICIENT_SUPPLIER_EVIDENCE',blockers,landedInput:null};

  const quotedFreight = numeric(source.bulkShippingToRomania)&&Number(source.bulkShippingToRomania)>=0
    ? Number(source.bulkShippingToRomania)
    : null;

  const missingForScreening=[];
  if(!numeric(source.productLengthCm))missingForScreening.push('product length');
  if(!numeric(source.productWidthCm))missingForScreening.push('product width');
  if(!numeric(source.productHeightCm))missingForScreening.push('product height');
  if(!numeric(source.actualGrossWeightKg))missingForScreening.push('actual gross weight');
  if(quotedFreight===null)missingForScreening.push('freight quote; estimate from carrier rules/chargeable weight instead');

  return {
    ready:true,
    status:mode==='VERIFIED_QUOTE'?'LANDED_INPUT_READY_SIMULATION_ONLY':'PAGE_BACKED_LANDED_SCREENING_READY',
    blockers:[],
    warnings:missingForScreening,
    landedInput:{
      productCanonicalKey:source.productCanonicalKey,
      supplierName:source.supplierName,
      quoteSourceUrl:source.sourceUrl,
      quoteVerifiedAt:mode==='VERIFIED_QUOTE'?source.manualVerifiedAt:null,
      quoteEvidenceStatus:mode==='VERIFIED_QUOTE'?'MANUALLY_VERIFIED_QUOTE':'SUPPLIER_PAGE_OBSERVED',
      evidenceMode:mode,
      currency:text(source.currency).toUpperCase(),
      unitPriceForeign:Number(source.unitPrice),
      quantity:qty,
      internationalFreightForeign:quotedFreight,
      shippingCurrency:quotedFreight!==null?text(source.shippingCurrency||source.currency).toUpperCase():null,
      incoterm:text(source.incoterm)||null,
      marketCode:market.code,
      importVatRatePct:market.importVatRatePct,
      sellVatRatePct:market.sellVatRatePct,
      freightMode:quotedFreight!==null?'QUOTE_TOTAL':'CARRIER_ESTIMATE_REQUIRED',
      productLengthCm:numeric(source.productLengthCm)?Number(source.productLengthCm):null,
      productWidthCm:numeric(source.productWidthCm)?Number(source.productWidthCm):null,
      productHeightCm:numeric(source.productHeightCm)?Number(source.productHeightCm):null,
      cartonLengthCm:numeric(source.cartonLengthCm)?Number(source.cartonLengthCm):null,
      cartonWidthCm:numeric(source.cartonWidthCm)?Number(source.cartonWidthCm):null,
      cartonHeightCm:numeric(source.cartonHeightCm)?Number(source.cartonHeightCm):null,
      actualGrossWeightKg:numeric(source.actualGrossWeightKg)?Number(source.actualGrossWeightKg):null,
      volumetricDivisor:null,
      chargeableWeightKg:null,
      transportSource:quotedFreight!==null?'SUPPLIER_QUOTE':'DHL_FEDEX_UPS_ESTIMATE',
      fxRate:null,
      internationalFreightRon:null,
      customsDutyRate:null,
      customsFixed:null,
      brokerage:null,
      domesticFreight:null,
      inspection:null,
      labelsPackaging:null,
      otherFixed:null,
      confirmed:false,
      screeningEligible:true,
      supplierContactRequired:false,
      userApprovalRequiredBeforeSampleOrOrder:true,
      missingForConfirmedLandedCost:[
        'FX rate used for the quote/page currency',
        quotedFreight!==null?'Romania freight converted to RON':'DHL/FedEx/UPS freight estimate or commercial quote',
        'carrier/service volumetric divisor when transport is weight-rated',
        'chargeable weight when transport is weight-rated',
        'applicable customs duty/rate',
        'customs/brokerage charges',
        'domestic freight where applicable',
        'inspection cost where applicable',
        'labels/packaging and other fixed costs where applicable'
      ]
    },
    policy:'Exact supplier product-page data is sufficient for screening and may seed landed-cost estimates. Missing non-critical values stay UNKNOWN or are explicitly estimated. Supplier contact is not required to continue screening. A page-backed estimate is not a supplier-confirmed commercial quote and does not authorize a sample, negotiation, order or purchase.'
  };
}

async function main(){
  const inputPath=process.argv[2];
  if(!inputPath){console.error('Usage: node scripts/verified-quote-to-landed-input.mjs <supplier-evidence.json> [out.json]');process.exitCode=2;return;}
  const outPath=process.argv[3]||'landed-cost-input-live.json';
  const source=JSON.parse(await fs.readFile(inputPath,'utf8'));
  const result=buildLandedInputFromVerifiedQuote(source);
  await fs.writeFile(outPath,JSON.stringify(result,null,2)+'\n');
  console.log(`Supplier evidence → landed input: ${result.status}; ready=${result.ready}; confirmed=false.`);
  if(!result.ready)process.exitCode=1;
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await main();
