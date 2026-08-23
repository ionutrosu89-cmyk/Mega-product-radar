import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

function text(v){return String(v??'').trim();}
function numeric(v){return v!==null&&v!==undefined&&!(typeof v==='string'&&v.trim()==='')&&Number.isFinite(Number(v));}

export function buildLandedInputFromVerifiedQuote(quote={}){
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
        'applicable customs duty/rate',
        'customs/brokerage charges',
        'domestic freight where applicable',
        'inspection cost where applicable',
        'labels/packaging and other fixed costs where applicable',
        'manual landed-cost verification'
      ]
    },
    policy:'A verified supplier quote may seed a landed-cost simulation, never a confirmed landed cost. FX, customs and remaining import costs must be explicit and manually verified; missing values are never assumed to be zero.'
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
