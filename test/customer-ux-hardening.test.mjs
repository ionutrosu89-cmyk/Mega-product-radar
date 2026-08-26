import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('public Netlify root serves commercial landing',async()=>{
  const netlify=await read('netlify.toml');
  assert.match(netlify,/from\s*=\s*"\/"/);
  assert.match(netlify,/to\s*=\s*"\/beta\.html"/);
  assert.match(netlify,/status\s*=\s*200/);
});

test('customer design system includes accessibility and mobile navigation guards',async()=>{
  const css=await read('customer-ui.css');
  assert.match(css,/focus-visible/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/customer-bottom-nav/);
  assert.match(css,/126px/);
});

test('customer shell exposes one consistent five-item mobile navigation without false active state',async()=>{
  const shell=await read('customer-shell.js');
  for(const label of ['Home','Discover','Radar','Watchlist','Cont'])assert.match(shell,new RegExp(`'${label}'`));
  assert.match(shell,/aria-current/);
  assert.match(shell,/aria-label','Navigație principală/);
  assert.match(shell,/'commercial-launch\.html':''/);
  assert.match(shell,/'onboarding\.html':''/);
});

test('onboarding is a four-step accessible flow with plan finder',async()=>{
  const html=await read('onboarding.html');
  const js=await read('onboarding.js');
  assert.match(html,/Pasul 1 din 4/);
  assert.equal((html.match(/class="onboarding-step"/g)||[]).length,4);
  assert.match(html,/aria-pressed="false"/);
  assert.match(html,/contact de încredere în China/);
  assert.match(js,/function planRecommendation/);
  assert.match(js,/PLAN_RECOMMENDED/);
  assert.match(js,/mpr_plan_finder_v1/);
});

test('account hides infrastructure language from primary customer sections',async()=>{
  const html=await read('account.html');
  const js=await read('account.js');
  assert.match(html,/Contul meu/);
  assert.match(html,/Setări avansate de sincronizare/);
  assert.doesNotMatch(html,/Account & Workspace 7\.0/);
  assert.doesNotMatch(html,/Supabase nu este conectat/);
  assert.doesNotMatch(html,/Cloud Sync<\/h2>/);
  assert.doesNotMatch(js,/Workspace cloud activ, separat prin RLS/);
});

test('Home retries transient JWT clock skew instead of exposing raw auth errors',async()=>{
  const js=await read('home.js');
  assert.match(js,/JWT issued at future/);
  assert.match(js,/refreshSession/);
  assert.doesNotMatch(js,/\$\{esc\(error\?\.message\|\|error\)\}/);
});

test('Opportunities prioritizes one primary detail action and canonical progressive disclosure',async()=>{
  const radar=await read('commercial-radar.js');
  assert.match(radar,/Opportunity Detail/);
  assert.match(radar,/nextValidationStepV1/);
  assert.match(radar,/Confidence/);
  assert.match(radar,/IGNORE/);
  assert.match(radar,/WATCH/);
  assert.match(radar,/VALIDATE/);
  assert.doesNotMatch(radar,/>Sales status</);
  assert.doesNotMatch(radar,/applyPrivateCommercialDecisions/);
});

test('build ships and injects customer UX assets across commercial pages',async()=>{
  const build=await read('scripts/build-site.mjs');
  assert.match(build,/customer-ui\.css/);
  assert.match(build,/customer-shell\.js/);
  assert.match(build,/customerPages=new Set/);
  assert.match(build,/opportunity-v5\.js/);
  assert.match(build,/opportunity-ux-v1\.js/);
  for(const page of ['home.html','top25.html','discover.html','commercial-radar.html','commercial-product.html','commercial-watchlist.html','commercial-launch.html','account.html'])assert.match(build,new RegExp(page.replace('.','\\.')));
});
