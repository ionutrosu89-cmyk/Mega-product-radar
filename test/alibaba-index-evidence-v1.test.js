import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlibabaIndexEvidence,rankAlibabaIndexEvidence} from '../alibaba-index-evidence-v1.js';

test('preserves exact configuration, public price and MOQ without promoting index evidence',()=>{
  const html=`<div class="card"><a href="//www.alibaba.com/product-detail/OEM-Desk-Organizer-with-File-Holder_1601111111111.html" title="OEM Desk Organizer with File Holder 5-Tier Paper Letter Tray Organizer with Sliding Drawer and 2 Pen Holder Mesh File Organizer">OEM Desk Organizer with File Holder 5-Tier Paper Letter Tray Organizer with Sliding Drawer and 2 Pen Holder Mesh File Organizer</a><span>$7.80-8.50</span><span>MOQ: 500 pieces</span><span>Ningbo Brt Imp & Exp Co., Ltd.</span></div>`;
  const [r]=extractAlibabaIndexEvidence(html,{sourceUrl:'https://www.alibaba.com/showroom/paper-tray-organizer.html'});
  assert.equal(r.externalId,'1601111111111');
  assert.equal(r.exactDistinctiveConfiguration,true);
  assert.equal(r.publicPriceCandidate.min,7.8);
  assert.equal(r.publicPriceCandidate.max,8.5);
  assert.equal(r.moqCandidate.value,500);
  assert.equal(r.detailEvidence,false);
  assert.equal(r.dimensions,null);
  assert.equal(r.truthPolicy.indexCardAloneIsMarketplaceMatch,false);
});

test('marks one-pen-holder card partial, not exact',()=>{
  const html=`<a href="/product-detail/Office-Desk-Organizer_1602222222222.html">Office Desk Organizer 5-Tier Paper Letter Tray with Drawer and Hanging Pen Holder</a> $10.90-12.90 MOQ: 500 pieces Shantou Hanyang Stationery Co., Ltd.`;
  const [r]=extractAlibabaIndexEvidence(html);
  assert.equal(r.exactDistinctiveConfiguration,false);
  assert.equal(r.partialDistinctiveConfiguration,true);
});

test('ranks exact configurations before partial and then by MOQ',()=>{
  const rows=[
    {externalId:'partial',exactDistinctiveConfiguration:false,partialDistinctiveConfiguration:true,moqCandidate:{value:1},publicPriceCandidate:{max:1}},
    {externalId:'exact500',exactDistinctiveConfiguration:true,partialDistinctiveConfiguration:true,moqCandidate:{value:500},publicPriceCandidate:{max:8}},
    {externalId:'exact50',exactDistinctiveConfiguration:true,partialDistinctiveConfiguration:true,moqCandidate:{value:50},publicPriceCandidate:{max:11}}
  ];
  assert.deepEqual(rankAlibabaIndexEvidence(rows).map(x=>x.externalId),['exact50','exact500','partial']);
});
