import assert from 'node:assert/strict';
import test from 'node:test';
import { LIVE_MIN_CHECKS, eligibleHistoryPoints, normalizeHistoryPoint, safeCompetitorDelta, safeHistorySummary, scanQuality } from '../data-quality.js';

test('LIVE requires five checks and foreign presence', () => {
  assert.equal(LIVE_MIN_CHECKS, 5);
  assert.equal(scanQuality({ checks: 5, foreignPresence: 1 }).level, 'LIVE');
  assert.equal(scanQuality({ checks: 4, foreignPresence: 2 }).level, 'PARTIAL');
  assert.equal(scanQuality({ checks: 8, foreignPresence: 0 }).level, 'PARTIAL');
});

test('history deltas ignore PARTIAL and legacy points', () => {
  const points = [
    { at: '1', score: 60, romaniaResults: 8 },
    { at: '2', score: 70, romaniaResults: 7, quality: 'LIVE' },
    { at: '3', score: 95, romaniaResults: 1, quality: 'PARTIAL' },
    { at: '4', score: 76, romaniaResults: 9, quality: 'LIVE' }
  ];
  assert.equal(eligibleHistoryPoints(points).length, 2);
  const summary = safeHistorySummary(points);
  assert.equal(summary.scans, 2);
  assert.equal(summary.totalScans, 4);
  assert.equal(summary.scoreDelta, 6);
  assert.equal(summary.competitorDelta, 2);
  assert.equal(safeCompetitorDelta(points), 2);
});

test('current history point receives explicit quality metadata', () => {
  const q = scanQuality({ checks: 6, foreignPresence: 2 });
  const p = normalizeHistoryPoint({ at: 'now', score: 82 }, q);
  assert.equal(p.quality, 'LIVE');
  assert.equal(p.sourceStatus, 'WEB_SIGNAL');
  assert.equal(p.checks, 6);
  assert.equal(p.foreignPresence, 2);
});
