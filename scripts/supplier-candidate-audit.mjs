import fs from 'node:fs/promises';

const input=process.argv[2]||'supplier-candidates/under-desk-headphone-hanger.json';
const outFile='supplier-candidate-audit-live.json';
const data=JSON.parse(await fs.readFile(input,'utf8'));
const candidates=Array.isArray(data.candidates)?data.candidates:[];

const audited=candidates.map((c,index)=>{
  const direct=/^https:\/\//i.test(String(c.sourceUrl||''));
  const observedPrice=Number(c.observedPriceMinUsd)>0&&Number(c.observedPriceMaxUsd)>=Number(c.observedPriceMinUsd);
  const observedMoq=Number(c.observedMoq)>0;
  const unsafeVerified=c.quoteVerified===true||c.landedCostEligible===true||String(c.evidenceStatus||'').includes('VERIFIED_QUOTE');
  return {
    rank:index+1,
    supplierName:c.supplierName,
    sourceType:c.sourceType,
    sourcePresent:direct,
    publicPriceObserved:observedPrice,
    publicMoqObserved:observedMoq,
    evidenceStatus:c.evidenceStatus,
    quoteVerified:false,
    landedCostEligible:false,
    verificationBlockers:[
      ...(c.sourceType==='DIRECT_PUBLIC_PRODUCT_PAGE'?[]:['direct product page/SKU still required']),
      'direct RFQ response with current unit pricing and currency',
      'sample cost and Romania sample shipping',
      'bulk Romania shipping/Incoterm',
      'lead time and carton data',
      'compliance/material evidence where applicable',
      'manual verification timestamp'
    ],
    safe:direct&&observedPrice&&observedMoq&&!unsafeVerified
  };
});

const result={
  version:'1.0',
  updatedAt:new Date().toISOString(),
  product:data.product,
  status:audited.length&&audited.every(x=>x.safe)?'CANDIDATE_LAYER_SAFE':'CANDIDATE_LAYER_REVIEW_REQUIRED',
  stats:{candidates:audited.length,directProductPages:candidates.filter(x=>x.sourceType==='DIRECT_PUBLIC_PRODUCT_PAGE').length,verifiedQuotes:0,landedCostEligible:0},
  candidates:audited,
  policy:'Public marketplace observations are candidate discovery evidence only. This audit never upgrades a public listing to a verified quote and never authorizes confirmed landed cost.'
};

await fs.writeFile(outFile,JSON.stringify(result,null,2)+'\n');
if(audited.some(x=>!x.safe))process.exitCode=1;
console.log(`Supplier candidate audit: ${result.status}; candidates=${result.stats.candidates}; verified quotes=0; landed cost eligible=0.`);
