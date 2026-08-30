import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlibabaEmbeddedProductRecords,AlibabaEmbeddedProductRecordTruthPolicy} from '../alibaba-embedded-product-record-v1.js';

test('binds exact productUrl and puretitle from the same embedded record',()=>{
  const html=`{\"productUrl\":\"https:\\/\\/www.alibaba.com\\/product-detail\\/Five-Layer-Metal-Iron-Mesh-Storage_1601564257747.html\",\"puretitle\":\"Five-Layer Metal Iron Mesh Storage Rack Office Organizer with Drawer and Two Pen Holders File Document Rack\",\"minPrice\":8.5,\"maxPrice\":8.7,\"moq\":1,\"companyName\":\"Foshan Yunsheng Boton Technology Co., Ltd\"}`;
  const [x]=extractAlibabaEmbeddedProductRecords(html,{sourceUrl:'https://www.alibaba.com/countrysearch/CN/metal-office-organizer.html'});
  assert.equal(x.externalId,'1601564257747');
  assert.equal(x.exactDistinctiveConfiguration,true);
  assert.equal(x.supplierName,'Foshan Yunsheng Boton Technology Co., Ltd');
  assert.deepEqual(x.publicPriceCandidate,{currency:'USD',min:8.5,max:8.7,raw:null});
  assert.deepEqual(x.moqCandidate,{value:1,raw:null});
  assert.equal(x.detailEvidence,false);
  assert.equal(x.truthPolicy.embeddedRecordAloneIsMarketplaceMatch,false);
});

test('real V6 wording without drawer remains non-exact and blocked from promotion',()=>{
  const html=`{\"productUrl\":\"https:\\/\\/www.alibaba.com\\/product-detail\\/Five-Layer-Metal-Iron-Mesh-Storage_1601564257747.html\",\"puretitle\":\"Five-Layer Metal Iron Mesh Storage Rack Office Organizer with Two Pen Holders File Document Rack\"}`;
  const [x]=extractAlibabaEmbeddedProductRecords(html);
  assert.equal(x.externalId,'1601564257747');
  assert.equal(x.signals.fiveTier,true);
  assert.equal(x.signals.twoPenHolders,true);
  assert.equal(x.signals.drawer,false);
  assert.equal(x.exactDistinctiveConfiguration,false);
  assert.equal(x.detailEvidence,false);
});

test('keeps missing commercial fields unknown rather than borrowing adjacent records',()=>{
  const html=`{\"productUrl\":\"https:\\/\\/www.alibaba.com\\/product-detail\\/Five-Layer-Metal-Iron-Mesh-Storage_1601564257747.html\",\"puretitle\":\"Five-Layer Metal Iron Mesh Storage Rack Office Organizer with Drawer and Two Pen Holders File Document Rack\"}{\"minPrice\":1.1,\"moq\":2,\"companyName\":\"Other Supplier Co., Ltd\"}`;
  const [x]=extractAlibabaEmbeddedProductRecords(html);
  assert.equal(x.externalId,'1601564257747');
  assert.equal(x.publicPriceCandidate,null);
  assert.equal(x.moqCandidate,null);
  assert.equal(x.supplierName,null);
});

test('does not emit unrelated embedded product records',()=>{
  const html=`{\"productUrl\":\"https:\\/\\/www.alibaba.com\\/product-detail\\/Camping-LED-Torch_1601201546179.html\",\"puretitle\":\"High Power Camping Rechargeable LED Torch\"}`;
  assert.deepEqual(extractAlibabaEmbeddedProductRecords(html),[]);
});

test('truth policy binds identity fields but does not grant direct detail or economics',()=>{
  assert.equal(AlibabaEmbeddedProductRecordTruthPolicy.embeddedRecordBindsUrlAndTitle,true);
  assert.equal(AlibabaEmbeddedProductRecordTruthPolicy.embeddedRecordIsDirectSupplierDetail,false);
  assert.equal(AlibabaEmbeddedProductRecordTruthPolicy.embeddedRecordAloneIsMarketplaceMatch,false);
  assert.equal(AlibabaEmbeddedProductRecordTruthPolicy.embeddedRecordCanAuthorizeEconomics,false);
  assert.equal(AlibabaEmbeddedProductRecordTruthPolicy.unknownEqualsZero,false);
});
