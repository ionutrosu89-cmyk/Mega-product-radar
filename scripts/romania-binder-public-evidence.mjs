import fs from 'node:fs';
import path from 'node:path';
import { EMAG_PUBLIC_SEARCH_TARGETS, buildEmagSearchUrl, parseEmagSearchHtml } from '../emag-public-search-probe.js';
import { TRENDYOL_PUBLIC_SEARCH_TARGETS, buildTrendyolSearchUrl, parseTrendyolSearchHtml } from '../trendyol-public-search-probe.js';

const outArg = process.argv.find(x => x.startsWith('--out='));
const outPath = outArg ? outArg.slice('--out='.length) : 'artifacts/romania-binder-public-evidence.json';
const timeoutMs = 20000;
const nicheKey = 'office:three-ring-binders';
const comparabilityKey = 'THREE_RING_ROUND_RING_BINDERS';

const emagTarget = EMAG_PUBLIC_SEARCH_TARGETS.find(x => x.nicheKey === nicheKey && x.comparabilityKey === comparabilityKey);
const trendyolTarget = TRENDYOL_PUBLIC_SEARCH_TARGETS.find(x => x.nicheKey === nicheKey && x.comparabilityKey === comparabilityKey);
if (!emagTarget || !trendyolTarget) throw new Error('BINDER_PUBLIC_TARGETS_MISSING');

async function getHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; MegaProductRadarPublicEvidence/1.0)',
        'accept-language': 'ro-RO,ro;q=0.9,en;q=0.7'
      }
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url, html };
  } catch (error) {
    return { ok: false, status: null, finalUrl: url, html: '', error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

const startedAt = new Date().toISOString();
const tasks = [
  {
    platform: 'EMAG',
    target: emagTarget,
    sourceUrl: buildEmagSearchUrl(emagTarget.query),
    parser: parseEmagSearchHtml
  },
  {
    platform: 'TRENDYOL',
    target: trendyolTarget,
    sourceUrl: buildTrendyolSearchUrl(trendyolTarget.query),
    parser: parseTrendyolSearchHtml
  }
];

const observations = [];
for (const task of tasks) {
  const fetched = await getHtml(task.sourceUrl);
  const parsed = task.parser(fetched.html, task.target);
  observations.push({
    platform: task.platform,
    market: 'RO',
    nicheKey,
    comparabilityKey,
    query: task.target.query,
    sourceUrl: task.sourceUrl,
    finalUrl: fetched.finalUrl,
    observedAt: new Date().toISOString(),
    httpStatus: fetched.status,
    fetchOk: fetched.ok,
    fetchError: fetched.error || null,
    blocked: parsed.blocked,
    productLinkLowerBound: parsed.productLinkLowerBound,
    productUrls: parsed.productUrls,
    declaredResultCountCandidate: parsed.declaredResultCountCandidate,
    declaredResultCountTrusted: false,
    listingCount: null,
    marketWideReviewed: false,
    comparabilityConfirmed: false,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    purchaseAuthorized: false,
    evidenceClass: parsed.blocked || !fetched.ok ? 'DIAGNOSTIC_ONLY' : 'PUBLIC_SEARCH_LOWER_BOUND_ONLY'
  });
}

const usableCount = observations.filter(x => x.fetchOk && !x.blocked).length;
const artifact = {
  schemaVersion: 'MPR_ROMANIA_BINDER_PUBLIC_EVIDENCE_V1',
  generatedAt: new Date().toISOString(),
  startedAt,
  candidate: { platform: 'AMAZON', externalId: 'B00INKVS82' },
  nicheKey,
  comparabilityKey,
  status: usableCount === 2 ? 'PUBLIC_LOWER_BOUND_EVIDENCE_CAPTURED' : usableCount > 0 ? 'PARTIAL_PUBLIC_EVIDENCE' : 'NO_USABLE_PUBLIC_EVIDENCE',
  observations,
  exactRomaniaGapConfirmed: false,
  promotionEligible: false,
  policy: {
    publicEvidenceOnly: true,
    unknownIsZero: false,
    lowerBoundIsExactCount: false,
    declaredCountIsTrustedAutomatically: false,
    manualScopeReviewRequired: true,
    exactComparableEvidenceRequiredOnBothPlatforms: true,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    providerSpendEur: 0,
    paidCallsTriggered: 0,
    purchaseAuthorized: false
  }
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ status: artifact.status, usableCount, observations: observations.map(x => ({ platform: x.platform, httpStatus: x.httpStatus, blocked: x.blocked, productLinkLowerBound: x.productLinkLowerBound })) }));
