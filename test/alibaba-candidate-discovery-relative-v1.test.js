import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlibabaProductCandidates} from '../alibaba-candidate-discovery-v1.js';

test('extracts absolute, protocol-relative, root-relative and escaped product URLs',()=>{
  const html=`
  <a href="https://www.alibaba.com/product-detail/Exact-A_1601111111111.html?x=1">A</a>
  <a href="//www.alibaba.com/product-detail/Exact-B_1602222222222.html">B</a>
  <a href="/product-detail/Exact-C_1603333333333.html">C</a>
  <script>{"url":"\\/product-detail\\/Exact-D_1604444444444.html"}</script>
  <script>{"url":"\\u002Fproduct-detail\\u002FExact-E_1605555555555.html"}</script>`;
  const rows=extractAlibabaProductCandidates(html,{limit:10});
  assert.deepEqual(rows.map(x=>x.externalId),[
    '1601111111111','1602222222222','1603333333333','1604444444444','1605555555555'
  ]);
  assert.ok(rows.every(x=>x.url.startsWith('https://')));
  assert.ok(rows.every(x=>!x.url.includes('?')));
});

test('deduplicates canonical product URLs and ignores non-product links',()=>{
  const html=`
  /product-detail/Same_1601111111111.html
  https://www.alibaba.com/product-detail/Same_1601111111111.html?foo=bar
  /trade/search?SearchText=desk`;
  const rows=extractAlibabaProductCandidates(html,{limit:10});
  assert.equal(rows.length,1);
  assert.equal(rows[0].externalId,'1601111111111');
});
