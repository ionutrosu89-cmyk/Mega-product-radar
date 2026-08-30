import test from 'node:test';
import assert from 'node:assert/strict';
import {corroborateAlibabaCommercialEvidence,AlibabaCommercialCorroborationTruthPolicy} from '../alibaba-commercial-corroboration-v1.js';

const embedded={platform:'ALIBABA',externalId:'1601649468378',url:'https://www.alibaba.com/product-detail/x_1601649468378.html',title:'Desk Organizer with File Holder 5-Tier Paper Letter Tray Organizer with Drawer and 2 Pen Holder',sourceUrl:'https://www.alibaba.com/countrysearch/CN/mesh-paper-holder.html',evidenceClass:'PUBLIC_SUPPLIER_EMBEDDED_PRODUCT_RECORD_EVIDENCE',exactDistinctiveConfiguration:true,detailEvidence:false,dimensions:null};

test('corroborates commercial fields only across the same exact Alibaba external id',()=>{
  const card={...embedded,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:10.88,max:10.88},moqCandidate:{value:50},supplierName:'Shenzhen Even Technology Co., Ltd.'};
  const [x]=corroborateAlibabaCommercialEvidence([embedded,card]);
  assert.equal(x.externalId,'1601649468378');
  assert.equal(x.evidenceClass,'PUBLIC_SUPPLIER_INDEX_CORROBORATED_COMMERCIAL_EVIDENCE');
  assert.deepEqual(x.publicPriceCandidate,{currency:'USD',min:10.88,max:10.88});
  assert.deepEqual(x.moqCandidate,{value:50});
  assert.equal(x.supplierName,'Shenzhen Even Technology Co., Ltd.');
  assert.equal(x.commercialCorroboration.priceCorroborated,true);
  assert.equal(x.detailEvidence,false);
  assert.equal(x.dimensions,null);
  assert.equal(x.truthPolicy.corroboratedCommercialEvidenceCanAuthorizeEconomics,false);
});

test('does not borrow commercial fields from a different Alibaba external id even with the same title',()=>{
  const other={...embedded,externalId:'1609999999999',evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:1,max:1},moqCandidate:{value:1},supplierName:'Wrong Supplier Co., Ltd.'};
  const rows=corroborateAlibabaCommercialEvidence([embedded,other]);
  const x=rows.find(r=>r.externalId==='1601649468378');
  assert.equal(x.publicPriceCandidate,null);
  assert.equal(x.moqCandidate,null);
  assert.equal(x.supplierName,null);
});

test('conflicting observations for the same id fail commercial fields closed',()=>{
  const a={...embedded,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:10,max:11},moqCandidate:{value:50},supplierName:'Supplier A Co., Ltd.'};
  const b={...embedded,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:9,max:12},moqCandidate:{value:100},supplierName:'Supplier B Co., Ltd.'};
  const [x]=corroborateAlibabaCommercialEvidence([embedded,a,b]);
  assert.equal(x.publicPriceCandidate,null);
  assert.equal(x.moqCandidate,null);
  assert.equal(x.supplierName,null);
  assert.equal(x.commercialCorroboration.priceConflict,true);
  assert.equal(x.commercialCorroboration.moqConflict,true);
  assert.equal(x.commercialCorroboration.supplierConflict,true);
});

test('truth policy never promotes corroboration to quote detail match economics or purchase',()=>{
  assert.equal(AlibabaCommercialCorroborationTruthPolicy.sameAlibabaExternalIdRequired,true);
  assert.equal(AlibabaCommercialCorroborationTruthPolicy.corroboratedCommercialEvidenceIsVerifiedQuote,false);
  assert.equal(AlibabaCommercialCorroborationTruthPolicy.corroboratedCommercialEvidenceIsDirectSupplierDetail,false);
  assert.equal(AlibabaCommercialCorroborationTruthPolicy.corroboratedCommercialEvidenceCanAuthorizeMatch,false);
  assert.equal(AlibabaCommercialCorroborationTruthPolicy.corroboratedCommercialEvidenceCanAuthorizeEconomics,false);
  assert.equal(AlibabaCommercialCorroborationTruthPolicy.purchaseAuthorized,false);
});
