import fs from 'node:fs/promises';

const startedAt = new Date().toISOString();

try {
  await import('./web-radar-scan.mjs');
  await import('./data-quality-postprocess.mjs');
  await import('./discovery-scan.mjs');
  let live = {}, discovery = {};
  try { live = JSON.parse(await fs.readFile('radar-live.json', 'utf8')); } catch {}
  try { discovery = JSON.parse(await fs.readFile('discovery-live.json', 'utf8')); } catch {}
  const status = {
    ok: true,
    status: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    updatedAt: live.updatedAt || null,
    newCandidates: Number(live.newCandidates || 0),
    totalProducts: Array.isArray(live.products) ? live.products.length : 0,
    model: 'Mega Product Radar 5.0',
    engine: 'Romania Arbitrage Engine v4.5 + Product Discovery Engine 5.0',
    dataQualityPolicy: live.dataQualityPolicy || null,
    discovery: {
      updatedAt: discovery.updatedAt || null,
      candidates: Array.isArray(discovery.products) ? discovery.products.length : 0,
      successfulChecks: Number(discovery.successfulChecks || 0)
    }
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
