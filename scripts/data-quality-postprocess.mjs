import fs from 'node:fs/promises';
import { normalizeHistoryPoint, safeCompetitorDelta, safeHistorySummary, scanQuality } from '../data-quality.js';

const LIVE_FILE = 'radar-live.json';
const HISTORY_FILE = 'radar-history.json';

const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}

const live = await readJson(LIVE_FILE, { products: [] });
const history = await readJson(HISTORY_FILE, { version: 1, products: {} });

for (const product of Array.isArray(live.products) ? live.products : []) {
  const key = slug(product.name);
  const scout = product.marketScout || {};
  const quality = scanQuality({ checks: scout.checks, foreignPresence: scout.foreignPresence, sourceStatus: product.sourceStatus });
  product.sourceStatus = quality.sourceStatus;
  product.dataQuality = quality;
  product.status = quality.level === 'LIVE' ? 'MEGA SCORE 4.5 • SEMNAL LIVE' : 'VALIDARE PARȚIALĂ • NU FOLOSI DELTA';

  const bucket = history.products?.[key];
  if (!bucket || !Array.isArray(bucket.points)) continue;

  bucket.points = bucket.points.map(point => {
    const sameScan = Boolean(product.lastChecked && point.at === product.lastChecked);
    if (sameScan) return normalizeHistoryPoint(point, quality);
    if (point.quality === 'LIVE' || point.quality === 'PARTIAL') return point;
    return { ...point, quality: 'PARTIAL', sourceStatus: point.sourceStatus || 'LEGACY', checks: n(point.checks), foreignPresence: n(point.foreignPresence) };
  });

  product.historySummary = safeHistorySummary(bucket.points);
  const competitionDelta = quality.level === 'LIVE' ? safeCompetitorDelta(bucket.points) : null;
  if (product.competitorIntel) {
    product.competitorIntel.delta = competitionDelta;
    product.competitorIntel.status = competitionDelta == null ? 'BASELINE' : competitionDelta >= 3 ? 'RISING' : competitionDelta <= -3 ? 'FALLING' : 'STABLE';
    product.competitorIntel.quality = quality.level === 'LIVE' ? 'LIVE_ONLY' : 'PARTIAL';
  }

  if (quality.level !== 'LIVE' && product.radarAlert) {
    product.radarAlert = { active: false, type: null, message: null, suppressed: true, reason: 'Scanare PARTIAL: alertele de trend/competiție sunt suprimate.' };
  }
}

history.version = Math.max(2, Number(history.version || 1));
history.qualityPolicy = '4.5: score and competitor deltas use LIVE history points only; legacy/partial points remain visible but do not drive deltas.';
history.updatedAt = new Date().toISOString();
live.dataQualityPolicy = { version: '4.5', liveMinChecks: 5, foreignPresenceMin: 1, historyDeltas: 'LIVE_ONLY' };
live.model = 'MEGA Score 4.5';
live.engine = 'Romania Arbitrage Engine v4.5';

await Promise.all([
  fs.writeFile(LIVE_FILE, JSON.stringify(live, null, 2) + '\n'),
  fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n')
]);

console.log('Data Quality 4.5 applied to radar-live.json and radar-history.json');
