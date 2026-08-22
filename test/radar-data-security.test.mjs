import assert from 'node:assert/strict';
import test from 'node:test';
import { createRadarDataHandler } from '../netlify/functions/radar-data.mjs';

function storeWith(payload = null) {
  return {
    async get(key) {
      if (key === 'latest') return payload ? JSON.stringify(payload) : null;
      if (key === 'scan-status') return JSON.stringify({ status: 'idle' });
      return null;
    },
    async set() {}
  };
}

function mockFetch(plan = 'RADAR') {
  return async url => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) return Response.json({ id: 'u1' });
    if (u.includes('/rest/v1/workspaces')) return Response.json([{ id: 'w1', plan }]);
    return new Response(null, { status: 404 });
  };
}

test('legacy radar data rejects anonymous access before reading blob', async () => {
  let storeCalled = false;
  const handler = createRadarDataHandler({
    getStore: () => { storeCalled = true; return storeWith(); },
    fetch: mockFetch('RADAR'),
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' }
  });
  const response = await handler(new Request('https://radar.example/api/radar/data'));
  assert.equal(response.status, 401);
  assert.equal(storeCalled, false);
  assert.match(response.headers.get('cache-control') || '', /private/);
  assert.equal(response.headers.get('vary'), 'Authorization');
});

test('Discover plan cannot access legacy raw radar blob', async () => {
  let storeCalled = false;
  const handler = createRadarDataHandler({
    getStore: () => { storeCalled = true; return storeWith(); },
    fetch: mockFetch('DISCOVER'),
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' }
  });
  const response = await handler(new Request('https://radar.example/api/radar/data', { headers: { authorization: 'Bearer token' } }));
  assert.equal(response.status, 403);
  assert.equal(storeCalled, false);
  const body = await response.json();
  assert.equal(body.plan, 'DISCOVER');
});

test('Radar plan can access protected technical payload', async () => {
  const handler = createRadarDataHandler({
    getStore: () => storeWith({ products: [{ name: 'Private technical product', supplierUrl: 'private' }], updatedAt: '2026-08-22T00:00:00Z' }),
    fetch: mockFetch('RADAR'),
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' }
  });
  const response = await handler(new Request('https://radar.example/api/radar/data', { headers: { authorization: 'Bearer token' } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.plan, 'RADAR');
  assert.equal(body.workspaceId, 'w1');
  assert.equal(body.products[0].name, 'Private technical product');
});
