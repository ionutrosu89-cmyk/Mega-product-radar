import assert from 'node:assert/strict';
import test from 'node:test';
import {createTop25HistoryHandler} from '../netlify/functions/top25-history.mjs';
import {createTop25RefreshHandler} from '../netlify/functions/top25-refresh.mjs';
test('retired history cannot read or seed any historical rows',async()=>{
  let calls=0;
  const options={env:{SUPABASE_SERVICE_ROLE_KEY:'test'},fetch:async()=>{calls++;throw new Error('Forbidden');}};
  const response=await createTop25HistoryHandler(options)(new Request('https://example.test/api/top25/history?niche=AUTO'));
  assert.equal(response.status,410);
  assert.equal((await response.json()).code,'HISTORICAL_TOP25_RETIRED');
  assert.equal((await createTop25RefreshHandler(options)()).status,204);
  assert.equal(calls,0);
});
