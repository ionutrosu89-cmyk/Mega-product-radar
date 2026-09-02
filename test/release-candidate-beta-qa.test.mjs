import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const journeyPages=['beta.html','pricing.html','login.html','home.html','onboarding.html','top25.html','discover.html','commercial-radar.html','commercial-launch.html','account.html','beta-feedback.html','terms.html','privacy.html'];

async function exists(file){try{await access(file,constants.R_OK);return true;}catch{return false;}}
function localRefs(html){const refs=[];for(const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)){const raw=match[1].trim();if(!raw||raw.startsWith('#')||raw.startsWith('http:')||raw.startsWith('https:')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('data:')||raw.startsWith('/api/'))continue;const clean=raw.split('#')[0].split('?')[0];if(clean&&clean!=='./')refs.push(clean);}return refs;}

test('commercial beta journey pages and their local assets resolve',async()=>{
  for(const page of journeyPages){assert.equal(await exists(page),true,`missing journey page: ${page}`);const html=await readFile(page,'utf8');for(const ref of localRefs(html)){const target=path.normalize(path.join(path.dirname(page),ref));assert.equal(await exists(target),true,`${page} -> missing ${ref}`);}}
});

test('signup preserves validated next destination like login does',async()=>{
  const source=await readFile('login.js','utf8');
  assert.match(source,/function destination\(\)/);
  assert.match(source,/if\(data\.session\)location\.href=destination\(\)/);
  assert.doesNotMatch(source,/if\(data\.session\)location\.href='home\.html'/);
});

test('pricing Free reflects roadmap market intelligence while legacy Top 25 remains available',async()=>{
  const pricing=await readFile('pricing.html','utf8');
  const pricingClient=await readFile('pricing.js','utf8');
  const publicPricing=`${pricing}\n${pricingClient}`;
  const discoverFn=await readFile('netlify/functions/commercial-discover.mjs','utf8');
  assert.match(publicPricing,/Category Universe \+ Top Products/);
  assert.match(publicPricing,/Top Sellers și Top Brands/);
  assert.match(publicPricing,/Vezi topurile gratuite/);
  assert.doesNotMatch(publicPricing,/3 vizualizări\/credite/);
  assert.doesNotMatch(pricingClient,/startSubscriptionCheckout/);
  assert.equal(await exists('top25.html'),true);
  assert.match(discoverFn,/const limit=full\?20:3/);
  assert.match(discoverFn,/slice\(0,limit\)/);
});

test('paid data stays behind authenticated server endpoints in commercial journey',async()=>{
  const discover=await readFile('discover.js','utf8');
  const radar=await readFile('commercial-radar.js','utf8');
  assert.match(discover,/\/api\/commercial\/discover/);
  assert.doesNotMatch(discover,/fetch\(['"](?:\.\/)?discovery-live\.json/);
  assert.match(radar,/\/api\/commercial\/radar/);
});

test('legal beta publishes the operator while real-money launch remains blocked',async()=>{
  const terms=await readFile('terms.html','utf8');
  const privacy=await readFile('privacy.html','utf8');
  assert.match(terms,/RED COMMERCE S\.R\.L\./);
  assert.match(privacy,/RED COMMERCE S\.R\.L\./);
  assert.match(terms,/nu există checkout activ/i);
  assert.match(privacy,/nu activăm abonamente cu plată/i);
});

test('billing lifecycle endpoints required for paid beta are present',async()=>{
  for(const file of ['netlify/functions/billing-checkout.mjs','netlify/functions/billing-webhook.mjs','netlify/functions/billing-status.mjs','netlify/functions/billing-change-plan.mjs','netlify/functions/billing-cancel.mjs','netlify/functions/billing-readiness.mjs'])assert.equal(await exists(file),true,`missing ${file}`);
});
