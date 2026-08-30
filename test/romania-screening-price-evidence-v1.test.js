import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSecondaryRomaniaScreeningPrice} from '../romania-screening-price-evidence-v1.js';

const base={
  market:'RO',currency:'RON',priceRon:90,
  title:'Organizator birou cu suport pixuri și sertar – utilitate zilnică violet',
  details:'Suport dosare birou; Material metal robust; Depozitare pe 5 niveluri cu sertar; Două suporturi pentru pixuri incluse',
  evidenceClass:'SECONDARY_PUBLIC_SEARCH_INDEX',sourceRef:'https://example.ro/category',retrievedAt:'2026-08-30T08:40:00Z',freshnessUpperBoundDays:28
};

test('recent structurally comparable secondary Romania price is screening eligible only',()=>{
  const x=validateSecondaryRomaniaScreeningPrice(base);
  assert.equal(x.status,'SCREENING_ELIGIBLE');
  assert.equal(x.confidence,'MEDIUM');
  assert.equal(x.priceRon,90);
  assert.equal(x.truthPolicy.secondaryIndexIsDirectMarketplaceObservation,false);
  assert.equal(x.truthPolicy.screeningEligibleIsConfirmedPrice,false);
});

test('stale secondary price fails closed',()=>{
  const x=validateSecondaryRomaniaScreeningPrice({...base,freshnessUpperBoundDays:31});
  assert.equal(x.status,'BLOCKED');
  assert.ok(x.blockers.includes('SECONDARY_PRICE_TOO_STALE_OR_UNKNOWN'));
});

test('near match missing identity signals fails closed',()=>{
  const x=validateSecondaryRomaniaScreeningPrice({...base,details:'Organizator birou din metal cu sertar'});
  assert.equal(x.status,'BLOCKED');
  assert.ok(x.blockers.includes('INSUFFICIENT_PRODUCT_COMPARABILITY'));
});

test('non-RON or non-Romania evidence cannot unlock screening',()=>{
  const x=validateSecondaryRomaniaScreeningPrice({...base,market:'US',currency:'USD'});
  assert.equal(x.status,'BLOCKED');
  assert.ok(x.blockers.includes('ROMANIA_MARKET_REQUIRED'));
  assert.ok(x.blockers.includes('RON_CURRENCY_REQUIRED'));
});
