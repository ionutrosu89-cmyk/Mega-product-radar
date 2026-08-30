const clean=v=>String(v??'').trim();

export const HistoricalSupplierDetailTruthPolicy=Object.freeze({
  sameAlibabaExternalIdRequired:true,
  historicalStructuredDetailIsVerifiedQuote:false,
  historicalStructuredDetailIsLandedCost:false,
  historicalStructuredDetailIsMarketplaceMatch:false,
  historicalStructuredDetailCanAuthorizeEconomics:false,
  historicalStructuredDetailCanAuthorizePurchase:false,
  imageInferenceUsed:false,
  unknownEqualsZero:false
});

export const HistoricalSupplierDetailEvidenceV1=Object.freeze([
  Object.freeze({
    platform:'ALIBABA',
    externalId:'1600756221959',
    sourceUrl:'https://www.alibaba.com/product-detail/Mesh-Desk-Organizer-With-File-Holder_1600756221959.html',
    observedAt:'2026-08-29T19:27:49.422Z',
    evidenceClass:'HISTORICAL_STRUCTURED_PUBLIC_SUPPLIER_DETAIL_EVIDENCE',
    title:'Mesh Desk Organizer With File Holder 5-Tier Paper Letter Tray Organizer Drawer 2 Pen Holder Magazine Holder for Office Supplies',
    supplierName:'Ningbo Koyo Imp & Exp Co., Ltd.',
    modelNumber:'KY230224022',
    color:'Black',
    material:'metal',
    productType:'desk organizer',
    primaryFunction:'organize desk supplies',
    formFactor:'desktop',
    technicalSpecs:Object.freeze({tiers:5,penHolders:2}),
    dimensions:null,
    unitWeightGrams:null,
    packCount:null,
    rawMinOrderQuantity:1000,
    imageUrls:Object.freeze([
      'https://sc04.alicdn.com/kf/H62fb42650da14a55b86cd3db00c486b7R.jpg',
      'https://sc04.alicdn.com/kf/H5624520a70d74fe28082c0aea5ba98be3.jpg',
      'https://sc04.alicdn.com/kf/Hf3e23d8c4055462aa0f1c3a2a087e5eeW.jpg',
      'https://sc04.alicdn.com/kf/Hb0ef98f1f92046fc8025787550bfa67fW.jpg',
      'https://sc04.alicdn.com/kf/Hc893d02caf21482b83af68f0ac4c2550U.jpg',
      'https://sc04.alicdn.com/kf/H2c89575f7a7e440f8d807b8e78c35401j.jpg'
    ]),
    provenance:Object.freeze({
      githubWorkflowRunId:33270914349,
      githubArtifactId:9720072160,
      githubArtifactDigest:'sha256:ccd9e50920583e4f1e21a220e777bb2483d3682e67b69240190386911538d7dc',
      apifyActor:'xtracto~alibaba-product-scraper',
      apifyRunId:'0pJFJUYgEZdVJ0jVf',
      apifyDatasetId:'6lgVDx6sk9rSZ6jRo',
      historicalReportedUsageUsd:0.035906867106287016,
      sourceArtifactSchema:'MPR_STRUCTURED_SUPPLIER_DETAIL_BATCH_V1'
    }),
    truthPolicy:HistoricalSupplierDetailTruthPolicy
  })
]);

export function fuseHistoricalSupplierDetail(rows=[],history=HistoricalSupplierDetailEvidenceV1){
  const byId=new Map((history||[]).map(x=>[clean(x.externalId),x]));
  return (rows||[]).map(row=>{
    const externalId=clean(row?.externalId);
    const detail=byId.get(externalId);
    if(!detail||String(row?.platform||'ALIBABA').toUpperCase()!=='ALIBABA')return row;
    if(clean(detail.externalId)!==externalId)return row;
    return {
      ...row,
      evidenceClass:'HISTORICAL_STRUCTURED_PUBLIC_SUPPLIER_DETAIL_EVIDENCE',
      detailEvidence:true,
      historicalDetailEvidence:{
        observedAt:detail.observedAt,
        sourceUrl:detail.sourceUrl,
        supplierName:detail.supplierName,
        modelNumber:detail.modelNumber,
        color:detail.color,
        material:detail.material,
        productType:detail.productType,
        primaryFunction:detail.primaryFunction,
        formFactor:detail.formFactor,
        technicalSpecs:detail.technicalSpecs,
        rawMinOrderQuantity:detail.rawMinOrderQuantity,
        imageUrls:detail.imageUrls,
        provenance:detail.provenance
      },
      supplierName:row.supplierName??detail.supplierName,
      moqCandidate:row.moqCandidate??{value:detail.rawMinOrderQuantity,raw:'historical structured detail MOQ'},
      dimensions:row.dimensions??detail.dimensions,
      truthPolicy:{...(row.truthPolicy||{}),...HistoricalSupplierDetailTruthPolicy}
    };
  });
}
