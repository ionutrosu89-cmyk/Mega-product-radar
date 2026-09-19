export const STAGE_POLICY_VERSION='MPR_EVIDENCE_STAGES_V1';
export const STAGES=Object.freeze(['DISCOVERED','PROMISING','VALIDATE','FINALIST','TEST_READY','BUY_READY']);
// Engines supply evidence facts, never a legacy label or array position.
export function evaluateStageFacts(f={}){
  const gates={trendConfirmed:f.trendConfirmed===true,romaniaExact:f.romaniaExact===true,
    supplierVerified:f.supplierVerified===true,economicsConfirmed:f.economicsConfirmed===true,
    importabilityPassed:f.importabilityPassed===true,fresh:f.fresh===true};
  const confidence=typeof f.confidence==='number'&&Number.isFinite(f.confidence)?f.confidence:null;
  let stage=f.promising===true?'PROMISING':'DISCOVERED';
  if(gates.trendConfirmed&&gates.romaniaExact&&gates.fresh&&f.marketQualified===true&&confidence!==null&&confidence>=50)stage='VALIDATE';
  if(stage==='VALIDATE'&&gates.supplierVerified&&gates.economicsConfirmed&&gates.importabilityPassed&&confidence>=60)stage='FINALIST';
  if(stage==='FINALIST'&&f.testGatesPassed===true)stage='TEST_READY';
  if(stage==='TEST_READY'&&f.measuredTestPassed===true)stage='BUY_READY';
  const blockers=Object.entries(gates).filter(([,v])=>!v).map(([k])=>`${k.toUpperCase()}_REQUIRED`);
  if(confidence===null||confidence<60)blockers.push('CONFIDENCE_60_REQUIRED_FOR_FINALIST');
  return {stage,gates,blockers,policyVersion:STAGE_POLICY_VERSION,purchaseAuthorized:false};
}
export function capStage(stage,ceiling){return STAGES[Math.min(Math.max(0,STAGES.indexOf(stage)),Math.max(0,STAGES.indexOf(ceiling)))];}
