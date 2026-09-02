import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {LEGAL_OPERATOR_CONFIG} from '../legal-operator-config.js';

const pages=await Promise.all([
  readFile(new URL('../terms.html',import.meta.url),'utf8'),
  readFile(new URL('../privacy.html',import.meta.url),'utf8'),
  readFile(new URL('../sources.html',import.meta.url),'utf8')
]);

test('confirmed RED COMMERCE identity is consistent in public legal pages',()=>{
  assert.equal(LEGAL_OPERATOR_CONFIG.name,'RED COMMERCE S.R.L.');
  assert.equal(LEGAL_OPERATOR_CONFIG.vat,'46520923');
  assert.equal(LEGAL_OPERATOR_CONFIG.registry,'J23/4881/2022');
  assert.equal(LEGAL_OPERATOR_CONFIG.supportEmail,'office.redcommerce@gmail.com');
  for(const page of pages){
    assert.match(page,/RED COMMERCE S\.R\.L\./);
    assert.match(page,/46520923/);
    assert.match(page,/J23\/4881\/2022/);
    assert.match(page,/Str\. Amurgului nr\. 30A, et\. 3, ap\. 13/);
    assert.match(page,/office\.redcommerce@gmail\.com/);
  }
});
