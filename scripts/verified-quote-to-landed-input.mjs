import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {activeMarketProfile} from '../market-profiles-v1.js';

function text(v){return String(v??'').trim();}
function numeric(v){return v!==null&&v!==undefined&&!(typeof v==='string'&&v.trim()==='')&&Number.isFinite(Number(v));}

export function buildLandedInputFromVerifiedQuote(quote={}){
  const market=activeMarketProfile();
  const blockers=[];
  if(quote?.verified!==true)blockers.push('quote is not verified');
  if(quote?.evidenceStatus!=='MANUALLY_VERIFIED_QUOTE')blockers.push('quote evidence status is not MANUALLY_VERIFIED_QUOTE');
  if(quote?.landedCostEligible!==true)blockers.push('quote is not landed-cost eligible');
  if(!text(quote.productCanonicalKey))blockers.push('product identity missing');
  if(!text(quote.supplierName))blockers.push('supplier identity missing');
  if(!numeric(quote.unitPrice)||Number(quote.unitPrice)<=0)blockers.push('verified unit price missing');
  if(!text(quote.currency))blockers.push('verified price currency missing');
  if(!numeric(quote.quoteQuantity)||Number(quote.quoteQuantity)<=0)blockers.push('verified quote quantity missing');
  if(!numeric(quote.bulkShippingToRomania)||Number(quote.bulkShippingToRomania)<0)blockers.push('verified Romania shipping missing');
  if(!text(quote.shippingCurrency))blockers.push('shipping currency missing');
  if(text(quote.shippingCurrency).toUpperCase()!==text(quote.currency).toUpperCase())blockers.push('mixed currencies require explicit conversion before landed-cost input');
  if(blockers.length)return {ready:false,status:'BLOCKED_UNVERIFIED_QUOTE',blockers,landedInput:null};

  return {
    ready:true,
    status:'LANDED_INPUT_READY_SIMULATION_ONLY',
    blockers:[],
    landedInput:{
      productCanonicalKey:quote.productCanonicalKey,
      supplierName:quote.supplierName,
      quoteSourceUrl:quote.sourceUrl,
      quoteVerifiedAt:quote.manualVerifiedAt,
      quoteEvidenceStatus:quote.evidenceStatus,
      currency:text(quote.currency).toUpperCase(),
      unitPriceForeign:Number(quote.unitPrice),
      quantity:Number(quote.quoteQuantity),
      internationalFreightForeign:Number(quote.bulkShippingToRomania),
      incoterm:text(quote.incoterm),
      marketCode:market.code,
      importVatRatePct:market.importVatRatePct,
      sellVatRatePct:market.sellVatRatePct,
      freightMode:'QUOTE_TOTAL',
      productLengthCm:numeric(quote.productLengthCm)?Number(quote.productLengthCm):null,
      productWidthCm:numeric(quote.productWidthCm)?Number(quote.productWidthCm):null,
      productHeightCm:numeric(quote.productHeightCm)?Number(quote.productHeightCm):null,
      cartonLengthCm:numeric(quote.cartonLengthCm)?Number(quote.cartonLengthCm):null,
      cartonWidthCm:numeric(quote.cartonWidthCm)?Number(quote.cartonWidthCm):null,
      cartonHeightCm:numeric(quote.cartonHeightCm)?Number(quote.cartonHeightCm):null,
      actualGrossWeightKg:numeric(quote.actualGrossWeightKg)?Number(quote.actualGrossWeightKg):null,
      volumetricDivisor:null,
      chargeableWeightKg:null,
      transportSource:'SUPPLIER_QUOTE',
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
      missingForConfirmedLandedCost:[
        'FX rate used for the quote currency',
        'Romania freight converted to RON',
        'carrier/service volumetric divisor when transport is weight-rated',
        'chargeable weight when transport is weight-rated',
        'applicable customs duty/rate',
        'customs/brokerage charges',
        'domestic freight where applicable',
        'inspection cost where applicable',
        'labels/packaging and other fixed costs where applicable',
        'manual landed-cost verification'
      ]
    },
    policy:'A verified supplier quote may seed a Romania landed-cost simulation, never a confirmed landed cost. Romania VAT comes from the active market profile; FX, customs, carrier charging basis and remaining import costs must be explicit and verified. Product dimensions may be sourced from a direct product page, but carton dimensions/weight or a verified total freight quote are required for transport economics. Missing values are never assumed to be zero.'
  };
}

async function main(){
  const inputPath=process.argv[2];
  if(!inputPath){console.error('Usage: node scripts/verified-quote-to-landed-input.mjs <verified-quote.json> [out.json]');process.exitCode=2;return;}
  const outPath=process.argv[3]||'landed-cost-input-live.json';
  const quote=JSON.parse(await fs.readFile(inputPath,'utf8'));
  const result=buildLandedInputFromVerifiedQuote(quote);
  await fs.writeFile(outPath,JSON.stringify(result,null,2)+'\n');
  console.log(`Verified quote → landed input: ${result.status}; ready=${result.ready}; confirmed=false.`);
  if(!result.ready)process.exitCode=1;
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await main();
