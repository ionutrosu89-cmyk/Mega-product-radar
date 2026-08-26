import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const sourcing=await fs.readFile(new URL('../sourcing-ops.js',import.meta.url),'utf8');
const supplier=await fs.readFile(new URL('../supplier-intelligence.js',import.meta.url),'utf8');
const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');

test('REPLIED handoff carries identity and prefill context only',()=>{
  assert.match(sourcing,/const params=\{product:r\.productName,supplier:r\.supplierName,platform:r\.platform\|\|''\}/);
  assert.match(sourcing,/isCanonicalProductId\(r\.canonicalProductId\)/);
  assert.match(sourcing,/params\.canonicalProductId=String\(r\.canonicalProductId\)\.toLowerCase\(\)/);
  assert.match(sourcing,/new URLSearchParams\(params\)/);
  assert.doesNotMatch(sourcing,/params\.(?:price|unitPrice|quotedPrice|moq|shipping|bulkShipping|compliance|verified)\s*=/i);
});

test('Quote Intake prefill is explicitly non-evidence and leaves commercial fields manual',()=>{
  assert.match(supplier,/function applyInboundQuoteContext\(\)/);
  assert.match(supplier,/Context preluat din Sourcing Ops/);
  assert.match(supplier,/Prețul, MOQ, transportul, linkul exact, documentele și verificarea manuală rămân obligatorii/);
  assert.match(supplier,/params\.get\('product'\)/);
  assert.match(supplier,/params\.get\('supplier'\)/);
  assert.match(supplier,/params\.get\('platform'\)/);
  assert.match(supplier,/params\.get\('canonicalProductId'\)/);
  assert.match(supplier,/isCanonicalProductId\(rawCanonicalProductId\)/);
  assert.doesNotMatch(supplier,/params\.get\('price'\)/);
  assert.doesNotMatch(supplier,/params\.get\('moq'\)/);
  assert.doesNotMatch(supplier,/params\.get\('bulkShipping'\)/);
  assert.doesNotMatch(supplier,/params\.get\('url'\)/);
});

test('Supplier Intelligence exposes Sourcing Ops and both pages ship in Netlify build',()=>{
  assert.match(supplier,/href=\"sourcing-ops\.html\"/);
  for(const file of ['sourcing-ops.html','sourcing-ops.js','supplier-intelligence.html','supplier-intelligence.js'])assert.match(build,new RegExp(`'${file.replace('.','\\.')}'`));
});
