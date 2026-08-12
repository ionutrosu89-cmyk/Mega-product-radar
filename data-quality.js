export const LIVE_MIN_CHECKS = 5;

const n = (v, min = 0, max = 10000) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : 0;
};

export function scanQuality({ checks = 0, foreignPresence = 0, sourceStatus = '' } = {}) {
  const normalizedChecks = Math.round(n(checks, 0, 99));
  const normalizedForeign = Math.round(n(foreignPresence, 0, 99));
  const live = normalizedChecks >= LIVE_MIN_CHECKS && normalizedForeign >= 1;
  return {
    level: live ? 'LIVE' : 'PARTIAL',
    sourceStatus: live ? 'WEB_SIGNAL' : 'PARTIAL',
    checks: normalizedChecks,
    foreignPresence: normalizedForeign,
    reason: live
      ? `Minimum ${LIVE_MIN_CHECKS} verificări web și cel puțin o prezență externă confirmată.`
      : `Necesită minimum ${LIVE_MIN_CHECKS} verificări web și cel puțin o prezență externă pentru LIVE.`,
    legacyStatus: String(sourceStatus || '')
  };
}

export function qualityOfPoint(point = {}) {
  if (point.quality === 'LIVE' || point.quality === 'PARTIAL') return point.quality;
  if (point.sourceStatus === 'WEB_SIGNAL' && n(point.checks) >= LIVE_MIN_CHECKS && n(point.foreignPresence) >= 1) return 'LIVE';
  return 'PARTIAL';
}

export function eligibleHistoryPoints(points = []) {
  return Array.isArray(points) ? points.filter(p => qualityOfPoint(p) === 'LIVE') : [];
}

export function safeHistorySummary(points = []) {
  const live = eligibleHistoryPoints(points);
  if (!live.length) return { scans: 0, totalScans: Array.isArray(points) ? points.length : 0, scoreDelta: null, competitorDelta: null, firstAt: null, lastAt: null, quality: 'PARTIAL' };
  const first = live[0], last = live.at(-1), prev = live.at(-2);
  return {
    scans: live.length,
    totalScans: Array.isArray(points) ? points.length : live.length,
    scoreDelta: live.length > 1 ? n(last.score) - n(first.score) : null,
    competitorDelta: prev ? n(last.romaniaResults, 0, 10) - n(prev.romaniaResults, 0, 10) : null,
    firstAt: first.at || null,
    lastAt: last.at || null,
    quality: 'LIVE_ONLY'
  };
}

export function safeCompetitorDelta(points = []) {
  const live = eligibleHistoryPoints(points);
  if (live.length < 2) return null;
  return n(live.at(-1).romaniaResults, 0, 10) - n(live.at(-2).romaniaResults, 0, 10);
}

export function normalizeHistoryPoint(point = {}, quality = {}) {
  const q = quality.level ? quality : scanQuality(quality);
  return {
    ...point,
    checks: n(point.checks || q.checks, 0, 99),
    foreignPresence: n(point.foreignPresence || q.foreignPresence, 0, 99),
    sourceStatus: q.sourceStatus || point.sourceStatus || 'PARTIAL',
    quality: q.level || 'PARTIAL'
  };
}
