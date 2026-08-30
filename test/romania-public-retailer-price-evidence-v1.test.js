import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRomaniaPublicRetailerCandidate, parseUnchilipirCategoryHtml} from '../romania-public-retailer-price-evidence-v1.js';

test('accepts comparable Romanian public retailer candidate',()=>{
  const x=evaluateRomaniaPublicRetailerCandidate({
    title:'Organizator birou cu suport pixuri si sertar',
    description:'Suport dosare birou. Material metal robust. Depozitare pe 5 niveluri cu sertar. Doua suporturi pentru pixuri incluse.',
    priceRon:90,
    sourceUrl:'https://example.ro/p'
  });
  assert.equal(x.comparable,true);
  assert.equal(x.priceRon,90);
});

test('rejects structurally different organizer',()=>{
  const x=evaluateRomaniaPublicRetailerCandidate({title:'Organizator birou',description:'Metal, 3 niveluri, un suport pix',priceRon:70});
  assert.equal(x.comparable,false);
  assert.ok(x.missingSignals.length>=2);
});

test('parses target from retailer category html',()=>{
  const html=`<html><body><h3>Organizator birou cu suport pixuri și sertar – utilitate zilnică violet</h3><p>Suport dosare birou și organizator practic Material metal robust Depozitare pe 5 niveluri cu sertar Două suporturi pentru pixuri incluse</p><div>90,00 lei</div></body></html>`;
  const x=parseUnchilipirCategoryHtml(html);
  assert.equal(x.status,'OBSERVED');
  assert.equal(x.selected.priceRon,90);
});

test('fails closed on missing target',()=>{
  const x=parseUnchilipirCategoryHtml('<html><body>alt produs</body></html>');
  assert.equal(x.status,'BLOCKED');
  assert.ok(x.blockers.includes('TARGET_PRODUCT_NOT_FOUND'));
});
