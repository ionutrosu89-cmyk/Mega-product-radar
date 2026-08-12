import fs from 'node:fs/promises';

const startedAt = new Date().toISOString();

try {
  await import('./web-radar-scan.mjs');
  let live = {};
  try { live = JSON.parse(await fs.readFile('radar-live.json', 'utf8')); } catch {}
  const status = {
    ok: true,
    status: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    updatedAt: live.updatedAt || null,
    newCandidates: Number(live.newCandidates || 0),
    totalProducts: Array.isArray(live.products) ? live.products.length : 0,
    model: null,
    engine: live.engine || 'Zero-cost web signal radar'
  };
  await fs.writeFile('scan-status.json', JSON.stringify(status, null, 2) + '\n');
  console.log('SCAN_STATUS', JSON.stringify(status));
} catch (error) {
  const message = String(error?.message || error);
  const status = {
    ok: false,
    status: 'error',
    startedAt,
    completedAt: new Date().toISOString(),
    error: message.slice(0, 1600)
  };
  await fs.writeFile('scan-status.json', JSON.stringify(status, null, 2) + '\n');
  console.error('SCAN_STATUS', JSON.stringify(status));
  process.exitCode = 1;
}
