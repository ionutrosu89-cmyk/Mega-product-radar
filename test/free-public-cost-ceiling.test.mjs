import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const FREE_PUBLIC_FUNCTIONS=[
  'netlify/functions/free-top25.mjs',
  'netlify/functions/free-cross-market.mjs',
  'netlify/functions/free-niche-top25.mjs',
  'netlify/functions/free-demand-event.mjs'
];
const PAID_PROVIDER_MARKERS=[
  'DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD','OPENAI_API_KEY','KEEPA_API_KEY',
  'STRIPE_SECRET_KEY','EBAY_CLIENT_SECRET','MPR_PAID_PROVIDER_CALLS_ENABLED',
  "from './_ebay-buy-auth.mjs'",'api.dataforseo.com','api.openai.com'
];

test('every public Free endpoint is server-rate-limited and contains no paid-provider credential path',async()=>{
  for(const file of FREE_PUBLIC_FUNCTIONS){
    const source=await readFile(file,'utf8');
    assert.match(source,/enforceRateLimit\s*\(/,`${file} must enforce a server-side rate limit`);
    for(const marker of PAID_PROVIDER_MARKERS)assert.equal(source.includes(marker),false,`${file} must not contain paid-provider marker ${marker}`);
  }
});

test('Free live niche expansion is rights-held by default and historical Top25 is the public alternative',async()=>{
  const source=await readFile('netlify/functions/free-niche-top25.mjs','utf8');
  assert.match(source,/MPR_FREE_LIVE_NICHES_APPROVED/);
  assert.match(source,/FREE_LIVE_NICHES_RIGHTS_HOLD/);
  assert.match(source,/publicAlternative:'\/api\/free\/top25'/);
});

test('Free production defaults explicitly remain zero-provider-spend and no paid billing',async()=>{
  const gate=await readFile('scripts/production-safety-gate.mjs','utf8');
  assert.match(gate,/providerSpendDefaultEur/);
  assert.match(gate,/paidCallsDefault/);
  assert.match(gate,/paidBillingDefault/);
  assert.match(gate,/scheduledCollectionDefault/);
});
