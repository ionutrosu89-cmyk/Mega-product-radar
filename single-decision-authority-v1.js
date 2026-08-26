const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();

export const CANONICAL_DECISION_STAGES=Object.freeze([
  'BLOCKED','REVIEW','VALIDATE','FINALIST','TEST_READY','TEST_RUNNING','TEST_VALIDATED','BUY_READY'
]);

const STAGE_RANK=Object.freeze(Object.fromEntries(CANONICAL_DECISION_STAGES.map((stage,index)=>[stage,index])));

function evidenceStage(packet={}){
  const status=upper(packet.status);
  if(packet.purchaseAuthorized===true)return {stage:'BLOCKED',reason:'PURCHASE_AUTHORITY_FORBIDDEN_IN_DECISION_PACKET'};
  if(status==='FINALIST_EVIDENCE_READY'&&packet.finalistEvidenceReady===true)return {stage:'FINALIST',reason:'FINALIST_EVIDENCE_CONFIRMED'};
  if(packet.validateEligible===true)return {stage:'VALIDATE',reason:'VALIDATE_EVIDENCE_CONFIRMED'};
  if(status.includes('REVIEW'))return {stage:'REVIEW',reason:'EVIDENCE_REVIEW_REQUIRED'};
  return {stage:'BLOCKED',reason:'EVIDENCE_NOT_READY'};
}

function testStage(realTestEvidence={}){
  const status=upper(realTestEvidence.status);
  const measured=realTestEvidence.measuredRealWorldEvidence===true;
  if(!measured)return null;
  if(realTestEvidence.buyReady===true&&status==='BUY_READY')return 'BUY_READY';
  if(realTestEvidence.testValidated===true||status==='TEST_VALIDATED')return 'TEST_VALIDATED';
  if(realTestEvidence.testRunning===true||status==='TEST_RUNNING')return 'TEST_RUNNING';
  if(realTestEvidence.testReady===true||status==='TEST_READY')return 'TEST_READY';
  return null;
}

function normalizeLegacySignals(signals=[]){
  const rows=Array.isArray(signals)?signals:[];
  return rows.map((signal,index)=>({
    source:text(signal?.source)||`legacy-${index+1}`,
    recommendation:upper(signal?.recommendation||signal?.status||signal?.decision)||'UNKNOWN',
    score:Number.isFinite(Number(signal?.score))?Number(signal.score):null,
    authority:false
  }));
}

export function buildCanonicalDecision({evidenceDecision={},realTestEvidence={},legacySignals=[]}={}){
  const base=evidenceStage(evidenceDecision);
  let stage=base.stage;
  const test=testStage(realTestEvidence);

  // Real-world test evidence may advance only after FINALIST evidence is established.
  if(test&&STAGE_RANK[base.stage]>=STAGE_RANK.FINALIST)stage=test;

  const legacy=normalizeLegacySignals(legacySignals);
  const legacyBuy=legacy.some(x=>['BUY','BUY_READY','STRONG_BUY'].includes(x.recommendation));
  const legacyConflict=legacyBuy&&stage!=='BUY_READY';

  return {
    schemaVersion:'MPR_SINGLE_DECISION_AUTHORITY_V1',
    authority:'EVIDENCE_DRIVEN_CANONICAL_DECISION',
    stage,
    evidenceStage:base.stage,
    reason:base.reason,
    legacySignals:legacy,
    legacyConflict,
    purchaseAuthorized:false,
    automaticPurchaseAllowed:false,
    policy:'SINGLE_AUTHORITY; EVIDENCE_OVERRIDES_LEGACY; LEGACY_SIGNALS_ARE_INFORMATIONAL_ONLY; LEGACY_BUY_CAN_NEVER_PROMOTE; BUY_READY_REQUIRES_MEASURED_REAL_WORLD_TEST_EVIDENCE; BUY_READY_IS_NOT PURCHASE_AUTHORITY; FAIL_CLOSED'
  };
}

export function canLegacySignalPromote(){return false;}
