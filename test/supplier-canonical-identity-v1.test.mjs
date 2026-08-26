import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

test('Supplier Intelligence imports canonical commercial identity bridge',async()=>{
  const src=await fs.readFile(new URL('../supplier-intelligence.js',import.meta.url),'utf8');
  assert.match(src,/commercial-identity-v1\.js/);
  assert.match(src,/domain-contracts-v1\.js/);
  assert.match(src,/canonicalProductId/);
});

test('Supplier Gate decision sync refuses verified quote without canonical id',async()=>{
  const src=await fs.readFile(new URL('../supplier-intelligence.js',import.meta.url),'utf8');
  assert.match(src,/row\.commercialVerified!==true\|\|!isCanonicalProductId\(row\.canonicalProductId\)/);
  assert.match(src,/return false/);
  assert.match(src,/writeCanonicalCommercialRecord/);
  assert.doesNotMatch(src,/all\[keyOf\(product\)\]/);
});

test('legacy supplier UI row may remain visible but is explicitly non decision eligible',async()=>{
  const src=await fs.readFile(new URL('../supplier-intelligence.js',import.meta.url),'utf8');
  assert.match(src,/IDENTITATE NECANONICĂ/);
  assert.match(src,/Supplier Gate cere și canonicalProductId/);
  assert.match(src,/IDENTITY BLOCKED/);
});

test('supplier persistence never grants purchase authority',async()=>{
  const src=await fs.readFile(new URL('../supplier-intelligence.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/purchaseAuthorized\s*:\s*true/);
  assert.doesNotMatch(src,/automaticPurchaseAllowed\s*:\s*true/);
});
