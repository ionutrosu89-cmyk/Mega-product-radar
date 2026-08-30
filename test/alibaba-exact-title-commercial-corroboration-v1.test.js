import test from 'node:test';
import assert from 'node:assert/strict';
import {corroborateAlibabaCommercialEvidenceByExactTitle,AlibabaExactTitleCommercialCorroborationTruthPolicy,normalizeAlibabaCommercialTitle} from '../alibaba-exact-title-commercial-corroboration-v1.js';

const title='OEM Desk Organizer with File Holder 5-Tier Paper Letter Tray Organizer with Sliding Drawer and 2 Pen Holder Mesh File Organizer';
const embedded={platform:'ALIBABA',externalId:'1601591745115',url:'https://www.alibaba.com/product-detail/x_1601591745115.html',title,sourceUrl:'https://www.alibaba.com/countrysearch/CN/mesh-paper-holder.html',evidenceClass:'PUBLIC_SUPPLIER_EMBEDDED_PRODUCT_RECORD_EVIDENCE',exactDistinctiveConfiguration:true,detailEvidence:false,dimensions:null};

test('normalizes punctuation and whitespace but does not use fuzzy matching',()=>{
  assert.equal(normalizeAlibabaCommercialTitle('  Desk Organizer, 5-Tier — Drawer  '),'desk organizer 5 tier drawer');
  assert.notEqual(normalizeAlibabaCommercialTitle('Desk organizer with drawer'),normalizeAlibabaCommercialTitle('Desk organizer without drawer'));
});

test('corroborates only a unique embedded identity from an id-less exact-title commercial observation',()=>{
  const card={platform:'ALIBABA',externalId:null,url:null,title:`  ${title}  `,sourceUrl:'https://www.alibaba.com/countrysearch/CN/mesh-paper-holder.html',evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:7.8,max:8.5},moqCandidate:{value:500},supplierName:'Ningbo Brt Imp & Exp Co., Ltd.'};
  const [x]=corroborateAlibabaCommercialEvidenceByExactTitle([embedded,card]);
  assert.equal(x.externalId,'1601591745115');
  assert.equal(x.evidenceClass,'PUBLIC_SUPPLIER_EXACT_TITLE_CORROBORATED_COMMERCIAL_EVIDENCE');
  assert.deepEqual(x.publicPriceCandidate,{currency:'USD',min:7.8,max:8.5});
  assert.deepEqual(x.moqCandidate,{value:500});
  assert.equal(x.supplierName,'Ningbo Brt Imp & Exp Co., Ltd.');
  assert.equal(x.detailEvidence,false);
  assert.equal(x.dimensions,null);
  assert.equal(x.exactTitleCommercialCorroboration.exactNormalizedTitleJoin,true);
});

test('alternate external id with the same exact title blocks the title join',()=>{
  const alternate={...embedded,externalId:'1609999999999',evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:1,max:1},moqCandidate:{value:1},supplierName:'Wrong Supplier'};
  const rows=corroborateAlibabaCommercialEvidenceByExactTitle([embedded,alternate]);
  assert.equal(rows.length,0);
});

test('two embedded product identities sharing the exact title are ambiguous and blocked',()=>{
  const second={...embedded,externalId:'1608888888888'};
  const card={platform:'ALIBABA',externalId:null,title,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:7.8,max:8.5},moqCandidate:{value:500},supplierName:'Supplier'};
  assert.equal(corroborateAlibabaCommercialEvidenceByExactTitle([embedded,second,card]).length,0);
});

test('conflicting id-less commercial observations clear only the conflicting fields',()=>{
  const a={platform:'ALIBABA',externalId:null,title,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:7.8,max:8.5},moqCandidate:{value:500},supplierName:'Supplier A'};
  const b={platform:'ALIBABA',externalId:null,title,evidenceClass:'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE',publicPriceCandidate:{currency:'USD',min:7.8,max:8.5},moqCandidate:{value:600},supplierName:'Supplier B'};
  const [x]=corroborateAlibabaCommercialEvidenceByExactTitle([embedded,a,b]);
  assert.deepEqual(x.publicPriceCandidate,{currency:'USD',min:7.8,max:8.5});
  assert.equal(x.moqCandidate,null);
  assert.equal(x.supplierName,null);
  assert.equal(x.exactTitleCommercialCorroboration.priceConflict,false);
  assert.equal(x.exactTitleCommercialCorroboration.moqConflict,true);
  assert.equal(x.exactTitleCommercialCorroboration.supplierConflict,true);
});

test('truth policy never turns exact-title screening into direct detail match economics or purchase',()=>{
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.exactNormalizedTitleJoin,true);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.exactTitleJoinRequiresSingleEmbeddedExternalId,true);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.alternateExternalIdBlocksTitleJoin,true);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.exactTitleCommercialEvidenceIsVerifiedQuote,false);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.exactTitleCommercialEvidenceIsDirectSupplierDetail,false);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.exactTitleCommercialEvidenceCanAuthorizeMatch,false);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.exactTitleCommercialEvidenceCanAuthorizeEconomics,false);
  assert.equal(AlibabaExactTitleCommercialCorroborationTruthPolicy.purchaseAuthorized,false);
});
