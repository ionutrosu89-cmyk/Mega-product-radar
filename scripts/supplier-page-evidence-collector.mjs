import fs from 'node:fs/promises';
import path from 'node:path';

const DIR='supplier-candidates';
const OUT='supplier-page-evidence-live.json';
const now=new Date().toISOString();
const arr=v=>Array.isArray(v)?v:[];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const text=v=>String(v??'').trim();
const directUrl=v=>/^https:\/\//i.test(text(v));

let files=[];
try{files=(await fs.readdir(DIR)).filter(x=>x.endsWith('.json'));}catch{}
const products=[];

for(const file of files){
  let data;try{data=JSON.parse(await fs.readFile(path.join(DIR,file),'utf8'));}catch{continue;}
  const productKey=text(data?.product?.canonicalKey||data?.productCanonicalKey||path.basename(file,'.json'));
  const productTitle=text(data?.product?.title||data?.productTitle||productKey);
  const candidates=arr(data?.candidates).map((x,index)=>{
    const priceMin=finite(x?.observedPriceMinUsd)?Number(x.observedPriceMinUsd):null;
    const priceMax=finite(x?.observedPriceMaxUsd)?Number(x.observedPriceMaxUsd):null;
    const moq=finite(x?.observedMoq)?Number(x.observedMoq):null;
    const pageBacked=directUrl(x?.sourceUrl)&&text(x?.supplierName)&&text(x?.productTitle)&&(priceMin!==null||priceMax!==null)&&moq>0&&String(x?.productMatch||'').toUpperCase()==='HIGH';
    return {
      rank:index+1,
      supplierName:text(x?.supplierName)||null,
      platform:text(x?.platform)||null,
      productTitle:text(x?.productTitle)||null,
      sourceUrl:text(x?.sourceUrl)||null,
      supplierProfileUrl:text(x?.supplierProfileUrl)||null,
      productMatch:String(x?.productMatch||'UNKNOWN').toUpperCase(),
      publicPriceMinUsd:priceMin,
      publicPriceMaxUsd:priceMax,
      conservativeScreeningUnitPriceUsd:priceMax??priceMin,
      publicMoq:moq,
      supplierYears:finite(x?.supplierYearsObserved)?Number(x.supplierYearsObserved):(finite(x?.supplierPageStandardData?.exportExperienceYears)?Number(x.supplierPageStandardData.exportExperienceYears):null),
      supplierRating:finite(x?.supplierRatingObserved)?Number(x.supplierRatingObserved):(finite(x?.supplierPageStandardData?.supplierRating)?Number(x.supplierPageStandardData.supplierRating):null),
      observedSalesCount:finite(x?.observedSalesCount)?Number(x.observedSalesCount):null,
      material:x?.material??null,
      productDimensions:x?.productDimensions??null,
      pageBackedScreeningReady:pageBacked,
      supplierContactRequired:false,
      evidenceClass:pageBacked?'DIRECT_OBSERVED':'UNKNOWN'
    };
  });
  products.push({
    canonicalKey:productKey,
    title:productTitle,
    sourceFile:path.join(DIR,file),
    status:candidates.some(x=>x.pageBackedScreeningReady)?'PAGE_BACKED_SCREENING_READY':'PAGE_EVIDENCE_INCOMPLETE',
    candidates,
    bestScreeningCandidate:candidates.filter(x=>x.pageBackedScreeningReady).sort((a,b)=>(a.conservativeScreeningUnitPriceUsd??Infinity)-(b.conservativeScreeningUnitPriceUsd??Infinity))[0]||null
  });
}

const out={
  schemaVersion:'MPR_SUPPLIER_PAGE_EVIDENCE_LIVE_V1',
  updatedAt:now,
  status:products.some(x=>x.status==='PAGE_BACKED_SCREENING_READY')?'READY':'EMPTY_OR_INCOMPLETE',
  products,
  stats:{
    products:products.length,
    pageBackedReady:products.filter(x=>x.status==='PAGE_BACKED_SCREENING_READY').length,
    candidatePages:products.reduce((s,x)=>s+x.candidates.length,0)
  },
  supplierOutreachEnabled:false,
  purchaseAuthorized:false,
  policy:'Page-backed sourcing only. Public product/supplier page data may feed conservative screening. Missing fields remain UNKNOWN. No supplier outreach is required.'
};
await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Supplier page evidence: ${out.stats.pageBackedReady}/${out.stats.products} products page-backed ready.`);
