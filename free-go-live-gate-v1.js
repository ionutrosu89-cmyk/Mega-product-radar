const passed=value=>value===true;
const count=value=>Number.isInteger(value)&&value>=0?value:0;

// A Free launch decision uses the curated, rights-cleared product coverage.
// Raw marketplace positions and passing code checks cannot fill that coverage.
export function evaluateFreeGoLive({coverage={},study={},evidence={}}={}){
  const blockers=[];
  const requireFlag=(flag,code)=>{if(!passed(evidence[flag]))blockers.push(code);};
  if(count(coverage.curatedNicheCount)<25||count(coverage.curatedPositions)<625)blockers.push('CURATED_25_X_25_REQUIRED');
  requireFlag('sourceDisplayRightsVerified','SOURCE_DISPLAY_RIGHTS_UNVERIFIED');
  requireFlag('pilotProductFlowConfirmed','PILOT_PRODUCT_FLOW_UNCONFIRMED');
  requireFlag('twoWorkspaceJourneyPassed','TWO_WORKSPACE_JOURNEY_UNVERIFIED');
  requireFlag('physicalPhonePassed','PHYSICAL_PHONE_TEST_MISSING');
  requireFlag('publicDomainAndRecoveryPassed','PUBLIC_ACCESS_OR_RECOVERY_UNVERIFIED');
  requireFlag('supportAndRestorePassed','SUPPORT_OR_RESTORE_UNVERIFIED');
  if(study.status!=='PASS'||count(study.participants)<5||count(study.productFlowSessions)<5||!(study.understandingPct>=80)||!(study.usefulnessPct>=60)||!(study.watchlistPct>=80))blockers.push('REAL_BETA_THRESHOLDS_UNMET');
  if(count(evidence.criticalIssues)>0||!Number.isInteger(evidence.criticalIssues))blockers.push('CRITICAL_ISSUES_NOT_CLEARED');
  return Object.freeze({schema:'MPR_FREE_GO_LIVE_GATE_V1',status:blockers.length?'NO_GO':'READY_FOR_HUMAN_REVIEW',blockers:Object.freeze(blockers),automaticLaunchAllowed:false,paidBillingEnabled:false});
}
