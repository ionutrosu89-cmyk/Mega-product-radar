const hasValue=v=>v!==null&&v!==undefined&&!(typeof v==='string'&&v.trim()==='');
const finite=v=>hasValue(v)&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const nonNegative=v=>finite(v)&&Number(v)>=0;
const text=v=>String(v??'').trim();
const validDate=v=>{const d=new Date(v);return Boolean(v)&&Number.isFinite(d.getTime());};

const EXPLICIT_COST_FIELDS=[
  ['internationalFreight','transport internațional'],
  ['customsDutyRate','taxă vamală %'],
  ['customsFixed','taxe vamale fixe'],
  ['brokerage','broker / comision vamal'],
  ['domesticFreight','transport intern România'],
  ['inspection','inspecție / control calitate'],
  ['labelsPackaging','etichete / ambalare'],
  ['otherFixed','alte costuri fixe']
];

export function evaluateLandedCostEvidence(input={}){
  const blockers=[];
  if(!text(input.currency))blockers.push('monedă ofertă');
  if(!positive(input.unitPriceForeign))blockers.push('preț furnizor / bucată');
  if(!positive(input.quantity))blockers.push('cantitate lot');
  if(!positive(input.fxRate))blockers.push('curs valutar explicit');
  if(!text(input.fxSource))blockers.push('sursa cursului valutar');
  if(!validDate(input.fxVerifiedAt))blockers.push('data verificării cursului valutar');

  for(const [field,label] of EXPLICIT_COST_FIELDS){
    if(!nonNegative(input[field]))blockers.push(`${label} explicit (0 dacă este verificat că nu se aplică)`);
  }

  const customsStatus=text(input.customsStatus).toUpperCase();
  if(!['RATE_VERIFIED','NOT_APPLICABLE'].includes(customsStatus))blockers.push('statut vamal verificat');
  if(customsStatus==='RATE_VERIFIED'&&!text(input.customsClassificationRef))blockers.push('referință clasificare vamală / HS-CN');
  if(customsStatus==='NOT_APPLICABLE'&&Number(input.customsDutyRate)!==0)blockers.push('taxă vamală 0 pentru NOT_APPLICABLE');

  const vatTreatment=text(input.importVatTreatment).toUpperCase();
  if(!['DEDUCTIBLE_EXCLUDED_FROM_COST','NON_DEDUCTIBLE_INCLUDED_IN_COSTS','NOT_APPLICABLE'].includes(vatTreatment))blockers.push('tratamentul TVA import verificat');
  if(vatTreatment==='NON_DEDUCTIBLE_INCLUDED_IN_COSTS'&&!text(input.vatCostReference))blockers.push('referință cost TVA nedeductibil inclus');

  if(!text(input.freightEvidenceRef))blockers.push('referință transport real');
  if(!text(input.supplierQuoteRef))blockers.push('referință ofertă furnizor verificată');
  if(!text(input.manualVerifiedBy))blockers.push('verificator manual');
  if(!validDate(input.manualVerifiedAt))blockers.push('timestamp verificare manuală');

  const ready=blockers.length===0;
  return{
    version:'1.0',
    readyForManualConfirmation:ready,
    status:ready?'EVIDENCE_COMPLETE':'EVIDENCE_INCOMPLETE',
    blockers,
    explicitZeroPolicy:'Zero counts only when the field was explicitly entered. Blank or missing cost fields remain blockers and are never silently converted into verified zero cost.',
    policy:'This checklist validates completeness of landed-cost evidence only. It does not decide customs/tax applicability and never confirms a cost automatically.'
  };
}
