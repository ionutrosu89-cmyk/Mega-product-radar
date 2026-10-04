import {FREE_TOP25_EXPANDED_IDS} from './free-top25-expanded-registry.js';
import {normalizeCrossMarketSnapshot} from './free-cross-market-registry.js';

const passed=value=>value===true;
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const validPercent=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;

// Both the complete Top25 launch and the limited editorial beta need the same
// real-user and operational evidence. Coverage is assessed by each gate.
export function evaluateFreeReleaseEvidence({study={},evidence={}}={}){
  const blockers=[];
  const requireFlag=(flag,code)=>{if(!passed(evidence[flag]))blockers.push(code);};
  requireFlag('sourceDisplayRightsVerified','SOURCE_DISPLAY_RIGHTS_UNVERIFIED');
  requireFlag('pilotProductFlowConfirmed','PILOT_PRODUCT_FLOW_UNCONFIRMED');
  requireFlag('twoWorkspaceJourneyPassed','TWO_WORKSPACE_JOURNEY_UNVERIFIED');
  requireFlag('physicalPhonePassed','PHYSICAL_PHONE_TEST_MISSING');
  requireFlag('publicDomainAndRecoveryPassed','PUBLIC_ACCESS_OR_RECOVERY_UNVERIFIED');
  requireFlag('supportAndRestorePassed','SUPPORT_OR_RESTORE_UNVERIFIED');
  if(study.status!=='PASS'||count(study.participants)<5||count(study.productFlowSessions)<5||study.productFlowSessions>study.participants||![study.understandingPct,study.usefulnessPct,study.watchlistPct].every(validPercent)||!(study.understandingPct>=80)||!(study.usefulnessPct>=60)||!(study.watchlistPct>=80))blockers.push('REAL_BETA_THRESHOLDS_UNMET');
  if(evidence.criticalIssues!==0)blockers.push('CRITICAL_ISSUES_NOT_CLEARED');
  return blockers;
}

// A Free launch decision uses the curated, rights-cleared product coverage.
// Raw marketplace positions and passing code checks cannot fill that coverage.
export function evaluateFreeGoLive({coverage={},study={},evidence={}}={},options={}){
  const blockers=[];
  const now=options.now instanceof Date?options.now:new Date();
  const snapshots=Array.isArray(coverage.curatedSnapshots)?coverage.curatedSnapshots:[];
  const normalized=snapshots.map(row=>normalizeCrossMarketSnapshot(row,{now}));
  const nicheIds=normalized.filter(row=>row?.platform==='MPR_GENERIC').map(row=>row.nicheId);
  const coverageVerified=snapshots.length===FREE_TOP25_EXPANDED_IDS.length
    &&nicheIds.length===FREE_TOP25_EXPANDED_IDS.length
    &&new Set(nicheIds).size===FREE_TOP25_EXPANDED_IDS.length
    &&FREE_TOP25_EXPANDED_IDS.every(id=>nicheIds.includes(id));
  if(!coverageVerified||count(coverage.curatedNicheCount)!==25||count(coverage.curatedPositions)!==625)blockers.push('CURATED_25_X_25_REQUIRED');
  const liveSnapshots=Array.isArray(coverage.liveSnapshots)?coverage.liveSnapshots:[];
  const liveByNiche=new Map(FREE_TOP25_EXPANDED_IDS.map(id=>[id,new Set()]));
  for(const raw of liveSnapshots){
    if(!raw?.platform)continue;
    const row=normalizeCrossMarketSnapshot(raw,{now});
    if(row&&['EBAY','ALIEXPRESS','AMAZON_US','AMAZON_DE'].includes(row.platform)&&liveByNiche.has(row.nicheId))liveByNiche.get(row.nicheId).add(row.platform);
  }
  if([...liveByNiche.values()].some(platforms=>platforms.size<2))blockers.push('TWO_MARKETPLACES_PER_NICHE_REQUIRED');
  blockers.push(...evaluateFreeReleaseEvidence({study,evidence}));
  return Object.freeze({schema:'MPR_FREE_GO_LIVE_GATE_V1',status:blockers.length?'NO_GO':'READY_FOR_HUMAN_REVIEW',blockers:Object.freeze(blockers),automaticLaunchAllowed:false,paidBillingEnabled:false});
}
