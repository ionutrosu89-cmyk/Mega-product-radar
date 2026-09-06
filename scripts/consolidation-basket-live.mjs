import fs from 'node:fs/promises';
import {optimizeTwoSkuFillV1} from '../consolidation-basket-v1.js';

const GOLDEN='golden-pipeline-live.json';
const SUPPLIERS='supplier-page-evidence-live.json';
const FX='data/fx-evidence/ro-fx-2026-09-06.json';
const OUT='consolidation-basket-live.json';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const key=s=>norm(s).replace(/\s+/g,'-');
const arr=v=>Array.isArray(v)?v:[];
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const read=async(p,f)=>{try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return f;}};

const golden=await read(GOLDEN,{items:[]});
const supplier=await read(SUPPLIERS,{products:[]});
const fx=await read(FX,{rounded:{EUR_RON:5.253,USD_RON:4.5199}});
const eurRon=num(fx?.rounded?.EUR_RON)||5.253;
const usdRon=num(fx?.rounded?.USD_RON)||4.5199;
const benchmark1M3Ron=197*eurRon;

function logisticsCandidate(product){
  const withDims=arr(product?.candidates).filter(x=>x.pageBackedScreeningReady===true&&x.productDimensions&&String(x.productMatch||'').toUpperCase()==='HIGH');
  return withDims.sort((a,b)=>(num(a.conservativeScreeningUnitPriceUsd)||999)-(num(b.conservativeScreeningUnitPriceUsd)||999))[0]||null;
}
function leader(product){
  return product?.bestScreeningCandidate||null;
}
function stageFor(productKey){
  return arr(golden.items).find(x=>key(x.name)===key(productKey))?.stage||'DISCOVERED';
}
function tierPriceUsd(candidate,qty){
  const tiers=arr(candidate?.publicPriceTiers).filter(x=>num(x.minQty)!==null&&num(x.unitPriceUsd)!==null&&qty>=Number(x.minQty)&&(x.maxQty===null||x.maxQty===undefined||qty<=Number(x.maxQty))).sort((a,b)=>Number(b.minQty)-Number(a.minQty));
  return tiers[0]?Number(tiers[0].unitPriceUsd):num(candidate?.conservativeScreeningUnitPriceUsd);
}
function packageDims(c){
  const d=c?.productDimensions||{};
  return {
    lengthCm:num(d.lengthCm)??num(d.packageLengthCm),
    widthCm:num(d.widthCm)??num(d.packageWidthCm),
    heightCm:num(d.heightCm)??num(d.packageHeightCm)
  };
}

const finalistProduct=arr(supplier.products).find(x=>key(x.canonicalKey)==='car-sunglasses-magnetic-visor-holder');
const finalistLeader=leader(finalistProduct);
const finalistLog=logisticsCandidate(finalistProduct);
const fillerProducts=arr(supplier.products).filter(x=>key(x.canonicalKey)!=='car-sunglasses-magnetic-visor-holder'&&['VALIDATE','FINALIST'].includes(stageFor(x.canonicalKey)));

const candidates=[];
for(const fp of fillerProducts){
  const fl=leader(fp),flog=logisticsCandidate(fp);
  if(!fl||!flog)continue;
  const a={
    packageDimensions:packageDims(finalistLog),
    unitPriceRon:(num(finalistLeader?.conservativeScreeningUnitPriceUsd)||0)*usdRon
  };
  const b={
    packageDimensions:packageDims(flog),
    unitGrossWeightKg:num(flog.unitGrossWeightKg),
    unitPriceRon:(num(fl?.conservativeScreeningUnitPriceUsd)||0)*usdRon
  };
  const result=optimizeTwoSkuFillV1({
    skuA:a,skuB:b,targetMeasure:1,
    maxQtyA:300,maxQtyB:1000,
    stepA:300,stepB:1
  });
  if(result.status!=='SCREENING_READY')continue;
  const finalistTierUsd=tierPriceUsd(finalistLeader,result.qtyA);
  const fillerTierUsd=tierPriceUsd(flog,result.qtyB);
  const repricedGoodsCapitalRon=(finalistTierUsd||0)*usdRon*result.qtyA+(fillerTierUsd||0)*usdRon*result.qtyB;
  const repricedResult={...result,estimatedGoodsCapitalRon:Number(repricedGoodsCapitalRon.toFixed(2)),pricingBasis:'PUBLIC_QUANTITY_TIER_WHEN_AVAILABLE',finalistUnitPriceUsd:finalistTierUsd,fillerUnitPriceUsd:fillerTierUsd};
  candidates.push({
    fillerCanonicalKey:fp.canonicalKey,
    fillerTitle:fp.title,
    fillerStage:stageFor(fp.canonicalKey),
    result:repricedResult,
    finalistLogisticsEvidence:{supplier:finalistLog.supplierName,sourceUrl:finalistLog.sourceUrl,dimensions:packageDims(finalistLog),truth:'HIGH_MATCH_COMPARABLE_VOLUME_FLOOR'},
    fillerLogisticsEvidence:{supplier:flog.supplierName,sourceUrl:flog.sourceUrl,dimensions:packageDims(flog),unitGrossWeightKg:num(flog.unitGrossWeightKg),truth:'DIRECT_PAGE_BACKED'},
    benchmark1M3Ron
  });
}
candidates.sort((a,b)=>a.result.estimatedGoodsCapitalRon-b.result.estimatedGoodsCapitalRon);
const selected=candidates[0]||null;
const output={
  schemaVersion:'MPR_CONSOLIDATION_BASKET_LIVE_V1',
  updatedAt:new Date().toISOString(),
  status:selected?'SCREENING_BASKET_AVAILABLE':'NO_FILLER_WITH_LOGISTICS_EVIDENCE',
  targetMeasure:1,
  benchmark1M3Ron:Number(benchmark1M3Ron.toFixed(2)),
  finalistCanonicalKey:'car-sunglasses-magnetic-visor-holder',
  selected,
  alternatives:candidates.slice(1,10),
  supplierOutreachEnabled:false,
  purchaseAuthorized:false,
  policy:'Basket optimization uses only page-backed logistics evidence and deep-stage SKUs. A VALIDATE filler may be used for logistics screening but is not order-authorized. Final basket quantities require each SKU to pass its own economics/demand gates.'
};
await fs.writeFile(OUT,JSON.stringify(output,null,2)+'\n');
console.log(`Consolidation basket: ${output.status}${selected?` · filler ${selected.fillerCanonicalKey}`:''}`);
