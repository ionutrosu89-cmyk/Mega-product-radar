import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../netlify/functions/radar-health.mjs',import.meta.url),'utf8');

test('public health endpoint does not inspect secrets or storage',()=>{
  for(const forbidden of ['OPENAI_API_KEY','RADAR_INTERNAL_SECRET','SUPABASE_SERVICE_ROLE_KEY','getStore','@netlify/blobs','.set(','.delete(']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});

test('public health endpoint is explicit liveness only',()=>{
  assert.match(source,/PUBLIC_FREE_BETA/);
  assert.match(source,/liveness:'UP'/);
  assert.match(source,/Cache-Control':'no-store'/);
});
