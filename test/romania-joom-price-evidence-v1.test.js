import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateJoomRomaniaCandidate,parseJoomRomaniaHtml} from '../romania-joom-price-evidence-v1.js';

test('accepts structurally comparable Romanian Joom listing with RON price',()=>{
  const c=evaluateJoomRomaniaCandidate({
    title:'Organizatoare de birou din metal cu plasă cu 5 niveluri cu 1 sertar și 2 suporturi pentru stilouri pentru fișiere A4',
    description:'Organizator birou office mesh metal, 5 niveluri, sertar, 2 suporturi pentru stilouri',
    priceRon:411.90,
    sourceUrl:'https://www.joom.com/ro/example'
  });
  assert.equal(c.comparable,true);
  assert.equal(c.priceRon,411.9);
  assert.equal(c.evidenceClass,'DIRECT_OBSERVED_ROMANIA_PUBLIC_MARKETPLACE_PRICE');
});

test('rejects near-match missing identity-critical signals',()=>{
  const c=evaluateJoomRomaniaCandidate({title:'Organizator birou metalic cu sertar',description:'metal office organizer',priceRon:99});
  assert.equal(c.comparable,false);
  assert.ok(c.missingSignals.length>=2);
});

test('parses exact target from localized public HTML',()=>{
  const html=`<html><body><div>Preț 411,90 RON Organizatoare de birou din metal cu plasă cu 5 niveluri cu 1 sertar și 2 suporturi pentru stilouri pentru fișiere A4, scrisori, corespondență</div></body></html>`;
  const x=parseJoomRomaniaHtml(html,'https://www.joom.com/ro/best/example');
  assert.equal(x.status,'OBSERVED');
  assert.equal(x.selected.priceRon,411.9);
  assert.equal(x.truthPolicy.unknownEqualsZero,false);
});

test('blocked page remains diagnostic only',()=>{
  const x=parseJoomRomaniaHtml('<html>Access denied - verify you are human</html>','https://www.joom.com/ro/best/example');
  assert.equal(x.status,'BLOCKED');
  assert.deepEqual(x.blockers,['SOURCE_BLOCKED']);
  assert.equal(x.selected,null);
});
