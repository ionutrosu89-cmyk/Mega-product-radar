import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('supplier-intelligence.html','utf8');
const js=fs.readFileSync('supplier-intelligence.js','utf8');
const build=fs.readFileSync('scripts/build-site.mjs','utf8');

test('Supplier UI exposes explicit sell-price scenario and blank FX inputs',()=>{
  for(const id of ['sellPriceRon','fxUsd','fxEur','fxCny'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/id="fxUsd"[^>]*placeholder="introdu manual"/);
  assert.doesNotMatch(html,/id="fxUsd"[^>]*value="[0-9]/);
  assert.match(html,/POTENȚIAL/);
  assert.match(html,/nu înseamnă landed cost confirmat/i);
});

test('Supplier UI uses negotiation engine without bypassing strict verifier',()=>{
  assert.match(js,/verifySupplierQuote/);
  assert.match(js,/evaluateQuoteNegotiation/);
  assert.match(js,/x\.strictQuote\|\|\{\}/);
  assert.match(js,/commercialVerified:verification\.verified===true/);
  assert.match(js,/Landed Cost rămâne separat/);
});

test('Netlify build ships every browser dependency for negotiation screening',()=>{
  for(const file of ['supplier-negotiation-engine.js','rfq-economics-envelope.js','supplier-quote-verifier.js']){
    assert.match(build,new RegExp(file.replaceAll('.','\\.')));
  }
});
