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

const netlify=await fs.readFile(new URL('../netlify.toml',import.meta.url),'utf8');
assert(netlify.includes('Netlify is the sole supported production SaaS target.'),'production target declaration missing');
assert(netlify.includes('command = "npm run build"'),'Netlify must use the repository build gate');

console.log(JSON.stringify({
  status:'PASS',
  amazonSourceRightsDefault:amazonRights.status,
  providerSpendDefaultEur:0,
  paidCallsDefault:0,
  rankingHistoryRemoteWriteDefault:false,
  scheduledRankingRemoteWriteDefault:false,
  productionSchedulerAttestationDefault:false,
  distributedExactlyOnceClaim:false,
  productionLockingClaim:false,
  productionAtomicityClaim:false,
  purchaseAuthorized:false,
  salesEvidenceClass:'NOT_VERIFIED_SALES'
},null,2));
