import fs from 'node:fs/promises';
import path from 'node:path';
import { EMAG_PUBLIC_SEARCH_TARGETS, buildEmagSearchUrl, parseEmagSearchHtml } from '../emag-public-search-probe.js';

const observedAt = new Date().toISOString();
const args = Object.fromEntries(process.argv.slice(2).map(x => {
  const [k, ...rest] = x.replace(/^--/, '').split('=');
  return [k, rest.join('=') || true];
}));
const out = String(args.out || 'artifacts/emag-direct-public-search-probe.json');

async function fetchTarget(target) {
  const url = buildEmagSearchUrl(target.query);
  const headers = {
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml',
    'accept-language': 'ro-RO,ro;q=0.9,en;q=0.7'
  };
  try {
    const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    const parsed = parseEmagSearchHtml(html, target);
    const usable = response.ok && !parsed.blocked && parsed.productLinkLowerBound > 0;
    return {
      ...parsed,
      sourceUrl: url,
      observedAt,
      statusCode: response.status,
      htmlBytes: html.length,
      usable,
      freshnessClass: usable ? 'LIVE_PUBLIC_SEARCH_PAGE' : 'UNUSABLE_LIVE_PROBE',
      evidenceClass: usable ? 'LIVE_PUBLIC_MARKET_SEARCH_PAGE' : 'DIAGNOSTIC_ONLY',
      comparableScopeConfirmed: false,
      marketWideCompetitionReady: false,
      error: null
    };
  } catch (error) {
    return {
      platform: 'EMAG',
      market: 'RO',
      nicheKey: target.nicheKey,
      comparabilityKey: target.comparabilityKey,
      query: target.query,
      sourceUrl: url,
      observedAt,
      statusCode: null,
      htmlBytes: 0,
      usable: false,
      blocked: false,
      productLinkLowerBound: 0,
      productUrls: [],
      declaredResultCountCandidate: null,
      declaredResultCountTrusted: false,
      sellerCount: null,
      freshnessClass: 'UNUSABLE_LIVE_PROBE',
      evidenceClass: 'DIAGNOSTIC_ONLY',
      salesEvidenceClass: 'NOT_VERIFIED_SALES',
      purchaseAuthorized: false,
      comparableScopeConfirmed: false,
      marketWideCompetitionReady: false,
      error: String(error?.message || error)
    };
  }
}

const observations = [];
for (const target of EMAG_PUBLIC_SEARCH_TARGETS) {
  observations.push(await fetchTarget(target));
  await new Promise(resolve => setTimeout(resolve, 1200));
}

const payload = {
  schemaVersion: 'MPR_EMAG_DIRECT_PUBLIC_SEARCH_PROBE_V1',
  generatedAt: observedAt,
  requestedTargets: EMAG_PUBLIC_SEARCH_TARGETS.length,
  usableTargets: observations.filter(x => x.usable).length,
  observations,
  gate: {
    status: 'MANUAL_REVIEW_REQUIRED',
    romaniaGapCompetitionReady: false,
    rule: 'A_LIVE_EMAG_SEARCH_PAGE_MAY_PROVE_DIRECT_MARKET_PRESENCE_AND_PAGE_LOWER_BOUND_BUT_CANNOT_BECOME_COMPARABLE_MARKET_COMPETITION_UNTIL_SCOPE_IS_MANUALLY_REVIEWED',
    blockedTargets: observations.filter(x => x.blocked).map(x => x.nicheKey),
    unusableTargets: observations.filter(x => !x.usable).map(x => x.nicheKey)
  },
  policy: {
    providerSpendEur: 0,
    paidCallsTriggered: 0,
    credentialsUsed: false,
    sellerApiUsed: false,
    externalExecutionTriggered: true,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    purchaseAuthorized: false,
    automaticPersistenceToMainData: false
  }
};

await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({
  requestedTargets: payload.requestedTargets,
  usableTargets: payload.usableTargets,
  blockedTargets: payload.gate.blockedTargets,
  lowerBounds: Object.fromEntries(observations.map(x => [x.nicheKey, x.productLinkLowerBound]))
}, null, 2));

if (payload.usableTargets === 0) process.exitCode = 2;
