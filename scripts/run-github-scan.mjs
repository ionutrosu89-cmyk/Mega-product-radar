import fs from 'node:fs/promises';

const startedAt = new Date().toISOString();

try {
  await import('./web-radar-scan.mjs');
  await import('./data-quality-postprocess.mjs');
  await import('./v2-validation-postprocess.mjs');
  await import('./discovery-scan.mjs');
  await import('./supplier-hunter-postprocess.mjs');
  await import('./discovery-v6-expand.mjs');
  let live = {}, discovery = {}, history = {};
  try { live = JSON.parse(await fs.readFile('radar-live.json', 'utf8')); } catch {}
  try { discovery = JSON.parse(await fs.readFile('discovery-live.json', 'utf8')); } catch {}
  try { history = JSON.parse(await fs.readFile('discovery-history.json', 'utf8')); } catch {}
  const status = {
    ok: true,
    status: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    updatedAt: live.updatedAt || null,
    newCandidates: Number(live.newCandidates || 0),
    totalProducts: Array.isArray(live.products) ? live.products.length : 0,
    model: 'Mega Product Radar V2',
    engine: 'Romania Arbitrage + Global Discovery + Romania Gap 2.0 + Trend Velocity + Supplier Hunter + Evidence Validation',
    dataQualityPolicy: live.dataQualityPolicy || null,
    v2Validation: live.v2Validation || null,
    discovery: {
      updatedAt: discovery.updatedAt || null,
      candidates: Array.isArray(discovery.products) ? discovery.products.length : 0,
      scanSize: Number(discovery.scanSize || 0),
      openDiscovered: Number(discovery.openDiscovered || 0),
      successfulChecks: Number(discovery.successfulChecks || 0),
      reviewChecks: Number(discovery.reviewChecks || 0),
      network: discovery.network || null,
      supplierHunter: discovery.supplierHunter || null,
      multilingual: discovery.multilingual || null,
      historyProducts: Object.keys(history.products || {}).length
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
    model: 'Mega Product Radar V2',
    error: message.slice(0, 1600)
  };
  await fs.writeFile('scan-status.json', JSON.stringify(status, null, 2) + '\n');
  console.error('SCAN_STATUS', JSON.stringify(status));
  process.exitCode = 1;
}
