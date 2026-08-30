import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRomaniaSellCandidate,parseEmagRomaniaSellSearchHtml} from '../romania-sell-price-evidence-v1.js';

const target={
  amazonAsin:'B09K5927B5',
  supplierListingKey:'1601573810318',
  title:'Organizator de birou cu suport pentru dosare, organizator cu 5 niveluri pentru hartie, cu sertar si 2 suporturi pentru pixuri, organizator de birou din plasa si depozitare cu suport pentru reviste'
};

test('accepts a strongly comparable Romania listing and keeps price as observed listing evidence',()=>{
  const html=`<html><head><script type="application/ld+json">${JSON.stringify({
    '@type':'Product',
    name:'Organizator de birou cu suport pentru dosare, 5 niveluri pentru hartie, sertar si 2 suporturi pentru pixuri, plasa metalica',
    url:'https://www.emag.ro/example/pd/DTH3T03BM/',
    offers:{'@type':'Offer',price:'74.99',priceCurrency:'RON'}
  })}</script></head><body></body></html>`;
  const result=parseEmagRomaniaSellSearchHtml(html,target);
  assert.equal(result.status,'PRICE_OBSERVED_COMPARABLE');
  assert.equal(result.selected.priceRon,74.99);
  assert.equal(result.selected.currency,'RON');
  assert.equal(result.truthPolicy.publicListingPriceIsRealizedSale,false);
  assert.equal(result.truthPolicy.searchResultIsVerifiedIdentity,false);
});

test('fails closed for a generic organizer even when price exists',()=>{
  const candidate={title:'Organizator birou cu 5 compartimente, plastic, roz',priceRon:59.99};
  const result=evaluateRomaniaSellCandidate(candidate,target);
  assert.equal(result.comparable,false);
  assert.ok(result.blockers.includes('IDENTITY_SIGNAL_COVERAGE_BELOW_THRESHOLD'));
});

test('fails closed when source is blocked',()=>{
  const result=parseEmagRomaniaSellSearchHtml('<html><body>Verify you are human</body></html>',target);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.blockers.includes('SOURCE_BLOCKED'));
  assert.ok(result.blockers.includes('NO_COMPARABLE_CURRENT_RON_PRICE'));
});
