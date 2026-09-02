import fs from 'node:fs/promises';
import {createEvidenceEnvelopeV2} from '../evidence-envelope-v2.js';
import {evaluatePolicyKernel} from '../policy-kernel-v1.js';
import {getSourceRights} from '../source-rights-registry-v1.js';

function fail(message){throw new Error(`PRODUCTION_SAFETY_GATE: ${message}`);}
function assert(condition,message){if(!condition)fail(message);}

const amazonRights=getSourceRights('AMAZON_PUBLIC_PRODUCT_PAGE');
assert(amazonRights.status==='UNKNOWN','Amazon public-page source rights must remain UNKNOWN by default');
assert(amazonRights.analysisAllowed===false,'Amazon public-page analysis rights must default false');
assert(amazonRights.commercialUseAllowed===false,'Amazon public-page commercial rights must default false');

const base={
  expectedIdentity:{marketplace:'AMAZON',externalId:'B00INKVS82'},
  observedIdentity:{marketplace:'AMAZON',externalId:'B00INKVS82'},
  source:{name:'SAFETY_SELF_TEST',url:'https://example.invalid',observedAt:'2026-08-27T00:00:00Z',collectedAt:'2026-08-27T00:00:01Z',parserVersion:'self-test'},
  provenance:{collector:'production-safety-gate',runId:'self-test',contentSha256:'self-test-sha'},
  sourceRights:{analysisAllowed:true,commercialUseAllowed:false,basis:'SELF_TEST_ONLY'},
  evidenceStrength:'STRONG',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0
};

const zeroCost=evaluatePolicyKernel(createEvidenceEnvelopeV2({...base,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false}));
assert(zeroCost.guards.spend.ok===true,'zero-cost evidence must pass SpendGuard');
assert(zeroCost.guards.purchase.ok===true,'purchase=false must pass PurchaseGuard');

const paid=evaluatePolicyKernel(createEvidenceEnvelopeV2({...base,providerDataSpendEur:0.01,paidDataCallsTriggered:1,purchaseAuthorized:false}));
assert(paid.decision==='HOLD','paid data activity must HOLD');
assert(paid.guards.spend.code==='PAID_DATA_ACTIVITY_BLOCKED','paid data activity must be blocked explicitly');

const purchase=evaluatePolicyKernel(createEvidenceEnvelopeV2({...base,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:true}));
assert(purchase.decision==='HOLD','purchase authorization must HOLD');
assert(purchase.guards.purchase.code==='PURCHASE_AUTHORIZATION_FORBIDDEN','purchase authorization must be forbidden');
assert(purchase.purchaseAuthorized===false,'Policy Kernel must never emit purchaseAuthorized=true');

const unsupportedSales=evaluatePolicyKernel(createEvidenceEnvelopeV2({...base,salesEvidenceClass:'VERIFIED_SALES',verifiedSalesRows:0,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false}));
assert(unsupportedSales.decision==='HOLD','unsupported VERIFIED_SALES must HOLD');
assert(unsupportedSales.guards.truth.code==='UNSUPPORTED_VERIFIED_SALES_CLAIM','unsupported VERIFIED_SALES must fail TruthGuard');

const providerSource=await fs.readFile(new URL('./provider-intelligence-v26.mjs',import.meta.url),'utf8');
assert(providerSource.includes("process.env.DATAFORSEO_V26_PAID_ENABLED||'false'"),'paid provider must remain disabled by default');

const commercialMode=await fs.readFile(new URL('../netlify/functions/_commercial-launch-mode.mjs',import.meta.url),'utf8');
assert(commercialMode.includes('MPR_PAID_BILLING_ENABLED'),'paid billing must require a separate explicit switch');
assert(commercialMode.includes('MPR_PAID_PROVIDER_CALLS_ENABLED'),'paid AI/data calls must require a separate explicit switch');

const radarTrigger=await fs.readFile(new URL('../netlify/functions/radar-trigger.mjs',import.meta.url),'utf8');
const radarBackground=await fs.readFile(new URL('../netlify/functions/radar-scan-background.mjs',import.meta.url),'utf8');
assert(radarTrigger.includes('paidProviderCallsEnabled(env)'),'Radar trigger must fail closed before launching a provider job');
assert(radarBackground.includes('paidProviderCallsEnabled(process.env)'),'Radar background must fail closed before OpenAI or storage activity');

const radarWorkflow=await fs.readFile(new URL('../.github/workflows/radar-scan.yml',import.meta.url),'utf8');
assert(!/schedule\s*:/.test(radarWorkflow),'free beta must not run automated scheduled collection');
assert(!/^\s+push\s*:/m.test(radarWorkflow),'free beta must not run collection on repository pushes');

const rankingHistoryRunner=await fs.readFile(new URL('./run-durable-ranking-history-cycle.mjs',import.meta.url),'utf8');
assert(rankingHistoryRunner.includes("process.env.MPR_RANKING_HISTORY_REMOTE_WRITE_ENABLED||'false'"),'remote ranking history writes must remain disabled by default');

const scheduledRankingRunner=await fs.readFile(new URL('./run-scheduled-ranking-history-tick.mjs',import.meta.url),'utf8');
assert(scheduledRankingRunner.includes("process.env.MPR_RANKING_HISTORY_REMOTE_WRITE_ENABLED||'false'"),'scheduled ranking remote writes must remain disabled by default');
assert(!scheduledRankingRunner.includes('purchaseAuthorized:true'),'scheduled ranking runner must not authorize purchase');

const observationInboxRunner=await fs.readFile(new URL('./run-live-observation-inbox.mjs',import.meta.url),'utf8');
assert(observationInboxRunner.includes("process.env.MPR_PRODUCTION_SCHEDULER_ATTESTATION_ENABLED||'false'"),'production scheduler attestation must remain disabled by default');
assert(!observationInboxRunner.includes('purchaseAuthorized:true'),'observation inbox runner must not authorize purchase');

const consumptionRunner=await fs.readFile(new URL('./run-observation-consumption-receipt.mjs',import.meta.url),'utf8');
assert(!consumptionRunner.includes('purchaseAuthorized:true'),'observation consumption runner must not authorize purchase');
assert(consumptionRunner.includes('not distributed exactly-once processing proof'),'consumption runner must preserve the exactly-once disclaimer');

const leaseRecoveryRunner=await fs.readFile(new URL('./run-observation-lease-recovery.mjs',import.meta.url),'utf8');
assert(!leaseRecoveryRunner.includes('purchaseAuthorized:true'),'lease recovery runner must not authorize purchase');
assert(leaseRecoveryRunner.includes('productionLockingVerified:false'),'local lease recovery must not claim production locking');
assert(leaseRecoveryRunner.includes('exactlyOnceGuaranteed:false'),'local lease recovery must not claim exactly-once delivery');

const atomicClaimRunner=await fs.readFile(new URL('./run-atomic-claim-drill.mjs',import.meta.url),'utf8');
assert(!atomicClaimRunner.includes('purchaseAuthorized:true'),'atomic claim runner must not authorize purchase');
assert(atomicClaimRunner.includes('productionAtomicityVerified:false'),'local atomic claim drill must not claim production atomicity');
assert(atomicClaimRunner.includes('distributedLockingVerified:false'),'local atomic claim drill must not claim distributed locking');
assert(atomicClaimRunner.includes('exactlyOnceGuaranteed:false'),'local atomic claim drill must not claim exactly-once delivery');

const productionAtomicAttestationRunner=await fs.readFile(new URL('./run-production-atomic-store-attestation.mjs',import.meta.url),'utf8');
assert(!productionAtomicAttestationRunner.includes('purchaseAuthorized:true'),'production atomic attestation runner must not authorize purchase');
assert(productionAtomicAttestationRunner.includes('productionAtomicityVerified:false'),'local production atomic attestation must not claim production atomicity');
assert(productionAtomicAttestationRunner.includes('distributedLockingVerified:false'),'local production atomic attestation must not claim distributed locking');
assert(productionAtomicAttestationRunner.includes('exactlyOnceGuaranteed:false'),'production atomic attestation runner must not claim exactly-once delivery');
assert(productionAtomicAttestationRunner.includes('No production adapter is contacted by this drill.'),'atomic attestation drill must preserve no-production-contact boundary');

const atomicFunctionalEvidenceRunner=await fs.readFile(new URL('./run-atomic-store-functional-evidence.mjs',import.meta.url),'utf8');
assert(!atomicFunctionalEvidenceRunner.includes('purchaseAuthorized:true'),'atomic functional evidence runner must not authorize purchase');
assert(atomicFunctionalEvidenceRunner.includes('productionAtomicityVerified:false'),'local functional evidence runner must not claim production atomicity');
assert(atomicFunctionalEvidenceRunner.includes('persistenceRestoreVerified:false'),'local functional evidence runner must not claim production restore verification');
assert(atomicFunctionalEvidenceRunner.includes('exactlyOnceGuaranteed:false'),'local functional evidence runner must not claim exactly-once delivery');
assert(atomicFunctionalEvidenceRunner.includes('Local memory CAS validates functional claim mechanics only.'),'functional evidence runner must preserve local-only boundary');

const persistenceRestoreRunner=await fs.readFile(new URL('./run-production-persistence-restore-evidence.mjs',import.meta.url),'utf8');
assert(!persistenceRestoreRunner.includes('purchaseAuthorized:true'),'persistence restore runner must not authorize purchase');
assert(persistenceRestoreRunner.includes('productionRestoreVerified:false'),'local persistence restore drill must not claim production restore verification');
assert(persistenceRestoreRunner.includes('productionStorageContacted:false'),'local persistence restore drill must not claim production storage contact');
assert(persistenceRestoreRunner.includes('LOCAL_ROUND_TRIP_ONLY'),'persistence restore drill must preserve local-only claim');
assert(persistenceRestoreRunner.includes('not production persistence restore evidence'),'persistence restore drill must preserve production disclaimer');

const workerTelemetryRunner=await fs.readFile(new URL('./run-production-worker-telemetry-evidence.mjs',import.meta.url),'utf8');
assert(!workerTelemetryRunner.includes('purchaseAuthorized:true'),'worker telemetry runner must not authorize purchase');
assert(workerTelemetryRunner.includes('productionRuntimeContacted:false'),'local worker telemetry drill must not claim production runtime contact');
assert(workerTelemetryRunner.includes('productionQueuesStable:false'),'local worker telemetry drill must not claim production queue stability');
assert(workerTelemetryRunner.includes('Local telemetry is not production queue stability evidence.'),'worker telemetry drill must preserve production disclaimer');

const latencyEvidenceRunner=await fs.readFile(new URL('./run-production-latency-evidence.mjs',import.meta.url),'utf8');
assert(!latencyEvidenceRunner.includes('purchaseAuthorized:true'),'latency evidence runner must not authorize purchase');
assert(latencyEvidenceRunner.includes('productionRuntimeContacted:false'),'local latency drill must not claim production runtime contact');
assert(latencyEvidenceRunner.includes('productionP95Verified:false'),'local latency drill must not claim production p95');
assert(latencyEvidenceRunner.includes('Local p95 is not production latency evidence.'),'latency evidence drill must preserve production disclaimer');

const scaleIngestionRunner=await fs.readFile(new URL('./run-scale-ingestion-window.mjs',import.meta.url),'utf8');
assert(!scaleIngestionRunner.includes('purchaseAuthorized:true'),'scale ingestion runner must not authorize purchase');
assert(scaleIngestionRunner.includes("report.scaleDecision!=='HOLD_SCALE'"),'local scale ingestion must assert HOLD_SCALE');
assert(scaleIngestionRunner.includes('productionRuntimeContacted:false'),'local scale ingestion must not claim production runtime contact');
assert(scaleIngestionRunner.includes('productionStorageContacted:false'),'local scale ingestion must not claim production storage contact');
assert(scaleIngestionRunner.includes('syntheticOrBootstrapCountIsNotProductionCanonicalScaleProof:true'),'bootstrap/synthetic count must not be promoted to production scale proof');
assert(scaleIngestionRunner.includes('not live ranking evidence, verified sales evidence, or production scale authorization'),'scale ingestion runner must preserve truth disclaimer');

const evidenceBundleSource=await fs.readFile(new URL('../production-evidence-bundle-v1.js',import.meta.url),'utf8');
assert(evidenceBundleSource.includes("inventoryClass!=='REAL_CANONICAL_PRODUCTS'"),'production evidence bundle must require real canonical product inventory');
assert(evidenceBundleSource.includes("purchaseAuthorized:false"),'production evidence bundle must preserve purchase=false');

const storageAdapterSource=await fs.readFile(new URL('../production-storage-adapter-v1.js',import.meta.url),'utf8');
assert(storageAdapterSource.includes('LOCAL_ADAPTER_CANNOT_PROVE_PRODUCTION_STORAGE'),'local storage adapter must fail closed for production persistence proof');

const netlify=await fs.readFile(new URL('../netlify.toml',import.meta.url),'utf8');
assert(netlify.includes('Netlify is the sole supported production SaaS target.'),'production target declaration missing');
assert(netlify.includes('command = "npm run build"'),'Netlify must use the repository build gate');

console.log(JSON.stringify({
  status:'PASS',
  amazonSourceRightsDefault:amazonRights.status,
  providerSpendDefaultEur:0,
  paidCallsDefault:0,
  paidBillingDefault:false,
  scheduledCollectionDefault:false,
  rankingHistoryRemoteWriteDefault:false,
  scheduledRankingRemoteWriteDefault:false,
  productionSchedulerAttestationDefault:false,
  distributedExactlyOnceClaim:false,
  productionLockingClaim:false,
  productionAtomicityClaim:false,
  productionAtomicAdapterContactDefault:false,
  productionRestoreClaim:false,
  productionStorageContactDefault:false,
  productionWorkerRuntimeContactDefault:false,
  productionQueuesStableClaim:false,
  productionLatencyRuntimeContactDefault:false,
  productionP95Claim:false,
  localScaleAuthorizationClaim:false,
  productionCanonicalScaleProofFromBootstrap:false,
  purchaseAuthorized:false,
  salesEvidenceClass:'NOT_VERIFIED_SALES'
},null,2));
