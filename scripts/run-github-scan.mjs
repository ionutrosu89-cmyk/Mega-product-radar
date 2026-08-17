import fs from 'node:fs/promises';

const startedAt = new Date().toISOString();
async function exists(path){try{await fs.access(path);return true;}catch{return false;}}

try {
  await import('./web-radar-scan.mjs');
  await import('./data-quality-postprocess.mjs');
  await import('./v2-validation-postprocess.mjs');
  await import('./wide-discovery-orchestrator.mjs');
  await import('./organic-rising-scan.mjs');
  await import('./organic-rising-review-enrich.mjs');
  await import('./organic-rising-quality-postprocess.mjs');
  await import('./supplier-hunter-postprocess.mjs');
  await import('./discovery-v6-expand.mjs');
  let live = {}, discovery = {}, history = {}, organic = {}, organicConfig = {};
  try { live = JSON.parse(await fs.readFile('radar-live.json', 'utf8')); } catch {}
  try { discovery = JSON.parse(await fs.readFile('discovery-live.json', 'utf8')); } catch {}
  try { history = JSON.parse(await fs.readFile('discovery-history.json', 'utf8')); } catch {}
  try { organic = JSON.parse(await fs.readFile('organic-rising-live.json', 'utf8')); } catch {}
  try { organicConfig = JSON.parse(await fs.readFile('organic-rising-config.json', 'utf8')); } catch {}
  const modules = {
    strictAudit: await exists('v2-audit.js'),
    evidenceValidation: await exists('scripts/v2-validation-postprocess.mjs'),
    globalDiscovery: await exists('scripts/discovery-scan.mjs') && await exists('scripts/wide-discovery-orchestrator.mjs'),
    organicRising: await exists('scripts/organic-rising-scan.mjs') && await exists('scripts/organic-rising-review-enrich.mjs') && await exists('scripts/organic-rising-quality-postprocess.mjs') && await exists('organic-rising-config.json'),
    romaniaGap2: await exists('discovery-engine.js'),
    trendVelocity: await exists('discovery-history.js'),
    supplierHunter: await exists('scripts/supplier-hunter-postprocess.mjs'),
    profitEngine: await exists('profit-engine-v2.js') && await exists('landed-cost.js'),
    importRiskGate: await exists('import-risk.js'),
    todaysOpportunities: await exists('todays-opportunities.html') && await exists('todays-opportunities.js'),
    premiumUI: await exists('premium-ui.css')
  };
  const configuredMarkets=Array.isArray(organicConfig.markets)?organicConfig.markets:[];
  const marketStatus=organic.marketStatus||{};
  const op=organicConfig.operationalPolicy||{};
  const minSuccessfulPagesTotal=Number(op.minSuccessfulPagesTotal||4);
  const minForeignMarkets=Number(op.minForeignMarkets||1);
  const minSuccessfulPagesPerForeignMarket=Number(op.minSuccessfulPagesPerForeignMarket||1);
  const minRomaniaSuccessfulPages=Number(op.minRomaniaSuccessfulPages||2);
  const requireRomaniaItems=op.requireRomaniaItems!==false;
  const foreignMarkets=configuredMarkets.filter(m=>m.kind==='foreign');
  const romaniaMarkets=configuredMarkets.filter(m=>m.kind==='romania');
  const healthyForeign=foreignMarkets.filter(m=>Number(marketStatus[m.key]?.successful||0)>=minSuccessfulPagesPerForeignMarket&&Number(marketStatus[m.key]?.items||0)>0);
  const healthyRomania=romaniaMarkets.filter(m=>Number(marketStatus[m.key]?.successful||0)>=minRomaniaSuccessfulPages&&(!requireRomaniaItems||Number(marketStatus[m.key]?.items||0)>0));
  const foreignCoverage=healthyForeign.length>=minForeignMarkets;
  const romaniaCoverage=romaniaMarkets.length===0||healthyRomania.length>0;
  const requiredCoverage=foreignCoverage&&romaniaCoverage;
  const qualityReady=organic.qualityPostprocess?.exactListingReviewGate===true&&organic.qualityPostprocess?.missingReviewIsNotZero===true&&organic.qualityPostprocess?.categoryRelevanceGate===true&&organic.qualityPostprocess?.imagePlaceholderFilter===true;
  const organicOperational=Number(organic.successfulPages||0)>=minSuccessfulPagesTotal&&Number(organic.totalObserved||0)>0&&requiredCoverage&&qualityReady;
  const moduleValues=Object.values(modules);
  const v2Ready=moduleValues.length>0&&moduleValues.every(Boolean)&&organicOperational;
  const status = {
    ok: true,
    status: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    updatedAt: live.updatedAt || null,
    newCandidates: Number(live.newCandidates || 0),
    totalProducts: Array.isArray(live.products) ? live.products.length : 0,
    model: 'Mega Product Radar V2',
    engine: 'Romania Arbitrage + Wide Global Discovery + Organic Rising + Romania Gap 2.0 + Trend Velocity + Supplier Hunter + Profit Engine + Import Risk + Evidence Validation',
    modules,
    v2Ready,
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
      historyProducts: Object.keys(history.products || {}).length,
      trendWarmup: Object.keys(history.products || {}).length > 0,
      mode: 'WIDE_DISCOVERY_STRICT_VALIDATION'
    },
    organicRising: {
      updatedAt: organic.updatedAt || null,
      category: organic.category || null,
      successfulPages: Number(organic.successfulPages || 0),
      totalObserved: Number(organic.totalObserved || 0),
      totalClusters: Number(organic.totalClusters || 0),
      feedCount: Array.isArray(organic.feed) ? organic.feed.length : 0,
      feedThreshold: Number(organic.feedThreshold || 0),
      operational: organicOperational,
      qualityReady,
      requiredCoverage,
      foreignCoverage,
      romaniaCoverage,
      healthyForeignMarkets: healthyForeign.map(m=>m.key),
      healthyRomaniaMarkets: healthyRomania.map(m=>m.key),
      operationalPolicy:{minSuccessfulPagesTotal,minForeignMarkets,minSuccessfulPagesPerForeignMarket,minRomaniaSuccessfulPages,requireRomaniaItems},
      marketStatus,
      reviewEnrichment: organic.reviewEnrichment || null,
      qualityPostprocess: organic.qualityPostprocess || null,
      policy: organic.policy || null
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
