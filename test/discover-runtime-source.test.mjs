import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

test('Netlify bundles Discover source JSON for runtime fallback',async()=>{
  const toml=await fs.readFile(new URL('../netlify.toml',import.meta.url),'utf8');
  assert.match(toml,/included_files\s*=\s*\[[^\]]*discovery-live\.json[^\]]*organic-rising-live\.json[^\]]*\]/s);
});

test('commercial Discover has filesystem fallback and runtime source diagnostics',async()=>{
  const fn=await fs.readFile(new URL('../netlify/functions/commercial-discover.mjs',import.meta.url),'utf8');
  assert.match(fn,/readFile/);
  assert.match(fn,/readBundledJson/);
  assert.match(fn,/HTTP_OR_BUNDLED_FILE/);
  assert.match(fn,/organicSourceStatus/);
  assert.match(fn,/organicEligibleProducts/);
  assert.match(fn,/amazonEvidenceCount/);
  assert.match(fn,/risingCount/);
});
