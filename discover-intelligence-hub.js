import {benchmarkSupplierQuotes,classifyQuoteAgainstBenchmark} from './supplier-benchmark-engine.js';
import {profitEngineV2} from './profit-engine-v2.js';

const n=v=>{
  if(v===null||v===undefined)return null;
  if(typeof v==='string'&&v.trim()==='')return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
};
const text=v=>String(v??'').trim();
const round=(v,d=2)=>{const x=n(v);return x===null?null:Number(x.toFixed(d));};

export function buildDiscoverIntelligence({product={},supplierQuotes=[],sellPriceRon=null,fxToRon=null,economicsSettings={}}={}){
  const productKey=text(product.productKey||product.canonicalKey);
  const relevant=supplierQuotes.filter(q=>text(q.productKey)===productKey);
  const benchmark=benchmarkSupplierQuotes(relevant).find(x=>x.productKey===productKey)||null;
  const fx=n(fxToRon);
  const sell=n(sellPriceRon);

  const quoteRows=relevant.map(q=>{
    const ddpUnit=n(q.ddpUnit);
    const ddpRon=ddpUnit!==null&&fx!==null?ddpUnit*fx:null;
    const economics=ddpRon!==null&&sell!==null?profitEngineV2({sellTarget:sell,landedEstimate:ddpRon},economicsSettings):null;
    const classification=benchmark?classifyQuoteAgainstBenchmark(q,benchmark):{classification:'INSUFFICIENT_DATA',variancePct:null};
    return {
      supplierKey:q.supplierKey||null,
      quantity:n(q.quantity),
      currency:q.currency||null,
      unitPrice:n(q.unitPrice),
      ddpTotal:n(q.ddpTotal),
      ddpUnit,
      ddpUnitRon:round(ddpRon),
      evidenceLevel:q.evidenceLevel||'UNVERIFIED',
      benchmarkClassification:classification.classification,
      varianceVsBenchmarkPct:classification.variancePct,
      economics:economics?{
        status:economics.priceComplete?'SCENARIO_READY':'INCOMPLETE',
        profitRon:round(economics.profit),
        marginPct:round(economics.margin,1),
        roiPct:round(economics.roi,1),
        breakEvenSellRon:round(economics.breakEvenSell),
        evidenceClass:'DERIVED_SCENARIO'
      }:{status:'INCOMPLETE',profitRon:null,marginPct:null,roiPct:null,breakEvenSellRon:null,evidenceClass:'UNKNOWN'}
    };
  });

  const economicsReady=quoteRows.filter(x=>x.economics.status==='SCENARIO_READY').length;
  const evidenceDocumented=relevant.filter(q=>['DOCUMENTED','MANUALLY_VERIFIED'].includes(q.evidenceLevel)).length;
  return {
    version:'1.0',
    product:{
      productKey:productKey||null,
      title:product.title||product.name||null,
      categoryKey:product.categoryKey||product.nicheKey||null,
      marketplace:product.marketplace||null,
      marketScore:n(product.marketScore),
      marketEvidenceClass:product.salesEvidenceClass||product.evidenceClass||'UNKNOWN'
    },
    supplierIntelligence:{
      quoteCount:relevant.length,
      documentedQuoteCount:evidenceDocumented,
      benchmark,
      quotes:quoteRows
    },
    scenarioInputs:{sellPriceRon:sell,fxToRon:fx},
    readiness:{
      supplierSample:relevant.length>=3?'BENCHMARK_SAMPLE':'EARLY_SAMPLE',
      economicsScenarios:economicsReady,
      fxRequired:relevant.some(q=>n(q.ddpUnit)!==null)&&fx===null,
      sellPriceRequired:sell===null
    },
    policy:{
      use:'DISCOVER_INTELLIGENCE_ONLY',
      purchaseAuthorized:false,
      landedConfirmed:false,
      note:'Supplier benchmarks and profit outputs are scenarios until underlying quote, FX, freight/import evidence and landed-cost evidence satisfy their separate verification standards.'
    }
  };
}

export function discoverPortfolioSummary(dossiers=[]){
  const rows=(dossiers||[]).filter(Boolean);
  return {
    products:rows.length,
    withSupplierData:rows.filter(x=>Number(x?.supplierIntelligence?.quoteCount||0)>0).length,
    withBenchmarkSample:rows.filter(x=>x?.readiness?.supplierSample==='BENCHMARK_SAMPLE').length,
    withEconomicsScenario:rows.filter(x=>Number(x?.readiness?.economicsScenarios||0)>0).length,
    purchaseAuthorized:false
  };
}
