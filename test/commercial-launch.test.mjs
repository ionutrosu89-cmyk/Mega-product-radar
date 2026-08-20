import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

test('Launch V1 is gated to LAUNCH plan and reuses private decisions',async()=>{
  const html=await fs.readFile(new URL('../commercial-launch.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../commercial-launch.js',import.meta.url),'utf8');
  assert.match(html,/Shortlist personalizat/);
  assert.match(html,/sourcing uman nelimitat/i);
  assert.match(js,/String\(data\.plan\)!=='LAUNCH'/);
  assert.match(js,/applyPrivateCommercialDecisions/);
  assert.match(js,/\/api\/commercial\/radar/);
});

test('Launch allocation requires TEST or BUY, confirmed landed and a real test budget',async()=>{
  const js=await fs.readFile(new URL('../commercial-launch.js',import.meta.url),'utf8');
  assert.match(js,/\['TEST','BUY'\]\.includes\(d\.commercialAction\)/);
  assert.match(js,/d\.landedCostConfirmed/);
  assert.match(js,/n\(d\.testBudget\)>0/);
  assert.match(js,/d\.testBudget<=left/);
  assert.match(js,/Nu aloca bani încă/);
});
