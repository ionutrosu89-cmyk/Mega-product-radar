import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmazonPublicRankingHtml,appendAmazonRankingSnapshots,buildAmazonRankingHistory} from '../amazon-public-ranking-snapshot-v1.js';

const at1='2026-08-25T10:00:00.000Z';
const at2='2026-08-26T10:00:00.000Z';
const sourceUrl='https://www.amazon.com/gp/bestsellers/office-products?language=en_US';
const categoryKey='amazon:office-products:best-sellers';

function card(rank,asin,title='Product'){
  return `<div class="zg-grid-general-faceout"><span class="zg-bdg-text">#${rank}</span><a href="/dp/${asin}/ref=zg_bs_test"><div class="_cDEzb_p13n-sc-css-line-clamp">${title}</div></a></div>`;
}

test('parses only explicit rank badges tied to ASINs',()=>{
  const html=`<html>${card(1,'B000000001','One')}${card(2,'B000000002','Two')}</html>`;
  const out=parseAmazonPublicRankingHtml({html,sourceUrl,observedAt:at1,categoryKey,categoryLabel:'Office Products'});
  assert.equal(out.ok,true);
  assert.equal(out.rankEvidenceCount,2);
  assert.deepEqual(out.observations.map(x=>[x.sourceRank,x.externalId]),[[1,'B000000001'],[2,'B000000002']]);
  assert.ok(out.observations.every(x=>x.salesEvidenceClass==='NOT_VERIFIED_SALES'));
  assert.ok(out.observations.every(x=>x.scope==='PUBLIC_RANKING_SURFACE'));
  assert.ok(out.observations.every(x=>x.purchaseAuthorized===false));
});

test('HTML order without explicit rank is not ranking evidence',()=>{
  const html='<a href="/dp/B000000001">First product</a><a href="/dp/B000000002">Second product</a>';
  const out=parseAmazonPublicRankingHtml({html,sourceUrl,observedAt:at1,categoryKey});
  assert.equal(out.ok,false);
  assert.equal(out.rankEvidenceCount,0);
});

test('blocked pages fail closed',()=>{
  const out=parseAmazonPublicRankingHtml({html:'<title>Robot Check</title>'+card(1,'B000000001'),sourceUrl,observedAt:at1,categoryKey});
  assert.equal(out.ok,false);
  assert.deepEqual(out.observations,[]);
  assert.ok(out.diagnostics.includes('AMAZON_PAGE_BLOCKED'));
});

test('rank badge without nearby ASIN is rejected',()=>{
  const out=parseAmazonPublicRankingHtml({html:'<span class="zg-bdg-text">#1</span><div>No product identity</div>',sourceUrl,observedAt:at1,categoryKey});
  assert.equal(out.ok,false);
  assert.ok(out.diagnostics.includes('RANK_1_ASIN_NOT_FOUND'));
});

test('append-only ledger rejects exact duplicate snapshots',()=>{
  const first=parseAmazonPublicRankingHtml({html:card(10,'B000000001'),sourceUrl,observedAt:at1,categoryKey}).observations;
  const one=appendAmazonRankingSnapshots([],first);
  assert.equal(one.appendedCount,1);
  const two=appendAmazonRankingSnapshots(one.snapshots,first);
  assert.equal(two.appendedCount,0);
  assert.equal(two.rejected[0].error,'DUPLICATE_RANKING_SNAPSHOT');
});

test('rank velocity requires at least 24 hours and uses improvement direction',()=>{
  const a=parseAmazonPublicRankingHtml({html:card(20,'B000000001'),sourceUrl,observedAt:at1,categoryKey}).observations[0];
  const b=parseAmazonPublicRankingHtml({html:card(8,'B000000001'),sourceUrl,observedAt:at2,categoryKey}).observations[0];
  const ledger=appendAmazonRankingSnapshots([], [a,b]).snapshots;
  const history=buildAmazonRankingHistory(ledger);
  assert.equal(history.trendReadyCount,1);
  assert.equal(history.products[0].rankImprovement,12);
  assert.equal(history.products[0].rankVelocityPerDay,12);
  assert.equal(history.products[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('short interval never produces rank velocity even with large movement',()=>{
  const a=parseAmazonPublicRankingHtml({html:card(50,'B000000001'),sourceUrl,observedAt:at1,categoryKey}).observations[0];
  const b=parseAmazonPublicRankingHtml({html:card(1,'B000000001'),sourceUrl,observedAt:'2026-08-25T23:00:00.000Z',categoryKey}).observations[0];
  const history=buildAmazonRankingHistory([a,b]);
  assert.equal(history.trendReadyCount,0);
  assert.equal(history.products[0].rankVelocityPerDay,null);
  assert.equal(history.products[0].rankImprovement,null);
});
