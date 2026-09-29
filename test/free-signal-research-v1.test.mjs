import assert from 'node:assert/strict';
import test from 'node:test';
import {buildFreeSignalResearchFeed,freeResearchLinks,freshPublishedFreeSignalResearchFeed,normalizeFreeSignalObservation} from '../free-signal-research-v1.js';

const now=new Date('2026-09-27T12:00:00Z');
const observation={nicheId:'BIROU_ORGANIZARE',sourceKey:'GOOGLE_TRENDS',claim:'SEARCH_INTEREST',sourceUrl:'https://trends.google.com/trends/explore?geo=RO&q=organizator%20birou',observedAt:'2026-09-26T12:00:00Z',periodStart:'2025-09-21',periodEnd:'2026-09-26',summary:'Interesul pentru termenul cercetat este un semnal comparativ, nu un volum absolut.',concept:'organizator birou',reviewer:'MPR editorial',publicStatus:'APPROVED_ORIGINAL_SUMMARY'};

test('Free research offers official destinations for all 25 niches',()=>{
  const feed=buildFreeSignalResearchFeed({observations:[]},{now});
  assert.equal(feed.niches.length,25);
  assert.equal(feed.observations.length,0);
  assert.equal(feed.policy.verifiedSalesClaimed,false);
  const links=freeResearchLinks('BIROU_ORGANIZARE');
  assert.equal(links.sources.length,3);
  assert.match(links.sources[0].url,/geo=RO/);
});

test('only recent reviewed original summaries with a matching official source are public',()=>{
  assert.ok(normalizeFreeSignalObservation(observation,{now}));
  assert.equal(normalizeFreeSignalObservation({...observation,publicStatus:'PENDING'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,sourceUrl:'https://example.com/'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,observedAt:'2026-07-01T00:00:00Z'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,observedAt:'2026-08-27T11:59:59Z',periodEnd:'2026-08-27'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,claim:'VERIFIED_SALES'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,summary:'Bestseller cu vânzări confirmate'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,sourceUrl:'https://trends.google.com/trends/explore?geo=US&q=organizator%20birou'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,sourceUrl:'https://trends.google.com/trends/explore?geo=RO&q=alt%20termen'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,periodEnd:'2026-07-01'},{now}),null);
  assert.equal(normalizeFreeSignalObservation({...observation,periodEnd:'2026-09-27'},{now}),null);
});

test('a renewed observation replaces the older review of the same source',()=>{
  const renewed={...observation,observedAt:'2026-09-27T09:00:00Z',periodEnd:'2026-09-27',summary:'Revizie nouă a aceluiași termen, tot cu indice relativ.'};
  const feed=buildFreeSignalResearchFeed({observations:[observation,renewed]},{now});
  assert.equal(feed.observations.length,1);
  assert.equal(feed.observations[0].summary,renewed.summary);
});

test('the public feed survives browser validation and expires when its observation ages out',()=>{
  const published=buildFreeSignalResearchFeed({observations:[observation]},{now});
  const inBrowser=freshPublishedFreeSignalResearchFeed(published,{now});
  assert.equal(inBrowser.observations.length,1);
  assert.equal(inBrowser.observations[0].concept,'organizator birou');
  assert.equal(freshPublishedFreeSignalResearchFeed(published,{now:new Date('2026-11-01T12:00:00Z')}).observations.length,0);
  assert.equal(freshPublishedFreeSignalResearchFeed({...published,schema:'WRONG'},{now}).observations.length,0);
});
