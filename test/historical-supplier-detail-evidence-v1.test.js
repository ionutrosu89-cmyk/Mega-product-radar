import test from 'node:test';
import assert from 'node:assert/strict';
import {HistoricalSupplierDetailEvidenceV1,HistoricalSupplierDetailTruthPolicy,fuseHistoricalSupplierDetail} from '../historical-supplier-detail-evidence-v1.js';

test('historical Koyo detail is exact-id bound and preserves unknown dimensions',()=>{
  const [h]=HistoricalSupplierDetailEvidenceV1;
  assert.equal(h.externalId,'1600756221959');
  assert.equal(h.modelNumber,'KY230224022');
  assert.equal(h.color,'Black');
  assert.equal(h.material,'metal');
  assert.deepEqual(h.technicalSpecs,{tiers:5,penHolders:2});
  assert.equal(h.dimensions,null);
  assert.equal(h.unitWeightGrams,null);
  assert.equal(h.packCount,null);
  assert.equal(h.provenance.githubWorkflowRunId,33270914349);
  assert.equal(h.provenance.githubArtifactId,9720072160);
});

test('fuses direct structured detail only into the same Alibaba external id',()=>{
  const input={platform:'ALIBABA',externalId:'1600756221959',title:'Mesh Desk Organizer With File Holder 5-Tier Paper Letter Tray Organizer Drawer 2 Pen Holder Magazine Holder for Office Supplies',exactDistinctiveConfiguration:true,detailEvidence:false,dimensions:null,publicPriceCandidate:{currency:'USD',min:9,max:9},moqCandidate:{value:1000}};
  const [x]=fuseHistoricalSupplierDetail([input]);
  assert.equal(x.detailEvidence,true);
  assert.equal(x.evidenceClass,'HISTORICAL_STRUCTURED_PUBLIC_SUPPLIER_DETAIL_EVIDENCE');
  assert.equal(x.historicalDetailEvidence.modelNumber,'KY230224022');
  assert.equal(x.dimensions,null);
  assert.equal(x.publicPriceCandidate.max,9);
  assert.equal(x.truthPolicy.historicalStructuredDetailIsMarketplaceMatch,false);
  assert.equal(x.truthPolicy.historicalStructuredDetailCanAuthorizeEconomics,false);
});

test('does not borrow Koyo detail into a different Alibaba id',()=>{
  const input={platform:'ALIBABA',externalId:'1601591745115',title:'OEM Desk Organizer',detailEvidence:false,dimensions:null};
  const [x]=fuseHistoricalSupplierDetail([input]);
  assert.equal(x.detailEvidence,false);
  assert.equal(x.historicalDetailEvidence,undefined);
});

test('non-Alibaba records never receive historical Alibaba detail',()=>{
  const input={platform:'AMAZON_US',externalId:'1600756221959',detailEvidence:false};
  const [x]=fuseHistoricalSupplierDetail([input]);
  assert.equal(x.detailEvidence,false);
});

test('historical detail never becomes quote landed economics match or purchase authority',()=>{
  assert.equal(HistoricalSupplierDetailTruthPolicy.sameAlibabaExternalIdRequired,true);
  assert.equal(HistoricalSupplierDetailTruthPolicy.historicalStructuredDetailIsVerifiedQuote,false);
  assert.equal(HistoricalSupplierDetailTruthPolicy.historicalStructuredDetailIsLandedCost,false);
  assert.equal(HistoricalSupplierDetailTruthPolicy.historicalStructuredDetailIsMarketplaceMatch,false);
  assert.equal(HistoricalSupplierDetailTruthPolicy.historicalStructuredDetailCanAuthorizeEconomics,false);
  assert.equal(HistoricalSupplierDetailTruthPolicy.historicalStructuredDetailCanAuthorizePurchase,false);
  assert.equal(HistoricalSupplierDetailTruthPolicy.imageInferenceUsed,false);
  assert.equal(HistoricalSupplierDetailTruthPolicy.unknownEqualsZero,false);
});
