import fs from 'node:fs/promises';

const startedAt = new Date().toISOString();

try {
  await import('./github-scan.mjs');
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
    model: live.model || process.env.RADAR_MODEL || 'gpt-5-mini'
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
    error: message.slice(0, 1200)
  };
  await fs.writeFile('scan-status.json', JSON.stringify(status, null, 2) + '\n');
  console.error('SCAN_STATUS', JSON.stringify(status));
  process.exitCode = 1;
}
