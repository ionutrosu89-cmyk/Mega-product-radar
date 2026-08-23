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
});

test('customer shell exposes one consistent five-item mobile navigation',async()=>{
  const shell=await read('customer-shell.js');
  for(const label of ['Home','Discover','Radar','Watchlist','Cont'])assert.match(shell,new RegExp(`'${label}'`));
  assert.match(shell,/aria-current/);
  assert.match(shell,/aria-label','Navigație principală/);
});

test('onboarding is a real three-step accessible flow',async()=>{
  const html=await read('onboarding.html');
  const js=await read('onboarding.js');
  assert.match(html,/Pasul 1 din 3/);
  assert.equal((html.match(/class="onboarding-step"/g)||[]).length,3);
  assert.match(html,/aria-pressed="false"/);
  assert.match(js,/function renderStep/);
  assert.match(js,/ONBOARDING_STEP_VIEW/);
});

test('account hides infrastructure language from primary customer sections',async()=>{
  const html=await read('account.html');
  assert.match(html,/Contul meu/);
  assert.match(html,/Setări avansate de sincronizare/);
  assert.doesNotMatch(html,/Account & Workspace 7\.0/);
  assert.doesNotMatch(html,/Supabase nu este conectat/);
  assert.doesNotMatch(html,/Cloud Sync<\/h2>/);
});

test('Radar prioritizes one primary product action and progressive disclosure',async()=>{
  const radar=await read('commercial-radar.js');
  assert.match(radar,/Vezi dosarul comercial/);
  assert.match(radar,/Vezi toate dovezile și gate-urile/);
  assert.match(radar,/Grad de validare/);
  assert.doesNotMatch(radar,/>Sales status</);
});

test('build ships and injects customer UX assets across commercial pages',async()=>{
  const build=await read('scripts/build-site.mjs');
  assert.match(build,/customer-ui\.css/);
  assert.match(build,/customer-shell\.js/);
  assert.match(build,/customerPages=new Set/);
  for(const page of ['home.html','top25.html','discover.html','commercial-radar.html','commercial-product.html','commercial-watchlist.html','commercial-launch.html','account.html'])assert.match(build,new RegExp(page.replace('.','\\.')));
});
