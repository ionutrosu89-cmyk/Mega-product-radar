function text(v){return String(v??'').trim();}
function hasNumericValue(v){return v!==null&&v!==undefined&&!(typeof v==='string'&&v.trim()==='')&&Number.isFinite(Number(v));}
function positive(v){return hasNumericValue(v)&&Number(v)>0;}
function nonNegative(v){return hasNumericValue(v)&&Number(v)>=0;}
function isoDate(v){const d=new Date(v);return Boolean(v)&&Number.isFinite(d.getTime());}

export function verifySupplierQuote(input={}){
  const blockers=[];
  const requireText=(field,label=field)=>{if(!text(input[field]))blockers.push(label);};
  const requirePositive=(field,label=field)=>{if(!positive(input[field]))blockers.push(label);};
  const requireNonNegative=(field,label=field)=>{if(!nonNegative(input[field]))blockers.push(label);};

  requireText('productCanonicalKey','product identity');
  requireText('supplierName','supplier name');
  requireText('platform','platform');
  if(!/^https:\/\//i.test(text(input.sourceUrl)))blockers.push('direct source URL');
  requireText('supplierSkuOrModel','exact SKU/model reference');
  if(input.exactProductConfirmed!==true)blockers.push('exact product confirmation');
  requirePositive('unitPrice','unit price');
  requireText('currency','price currency');
  requirePositive('quoteQuantity','quoted quantity');
  requirePositive('moq','MOQ');
  requireNonNegative('sampleCost','sample cost');
  requireNonNegative('sampleShippingToRomania','sample shipping to Romania');
  requirePositive('leadTimeDays','lead time');
  requireText('incoterm','Incoterm');
  requireNonNegative('bulkShippingToRomania','bulk shipping to Romania');
  requireText('shippingCurrency','shipping currency');
  requirePositive('cartonQuantity','carton quantity');
  requirePositive('cartonGrossWeightKg','carton gross weight');
  requirePositive('cartonLengthCm','carton length');
  requirePositive('cartonWidthCm','carton width');
  requirePositive('cartonHeightCm','carton height');
  requireText('paymentTerms','payment terms');
  if(typeof input.tradeAssuranceOrEquivalent!=='boolean')blockers.push('order protection status');
  if(input.inspectionAccepted!==true)blockers.push('inspection acceptance');

  const compliance=text(input.complianceStatus).toUpperCase();
  if(!['PROVIDED','NOT_APPLICABLE'].includes(compliance))blockers.push('compliance status/evidence');
  if(compliance==='PROVIDED'&&(!Array.isArray(input.complianceEvidence)||input.complianceEvidence.length===0))blockers.push('compliance evidence files/references');

  if(!isoDate(input.quotedAt))blockers.push('quote timestamp');
  if(!isoDate(input.quoteValidUntil))blockers.push('quote validity');
  if(!isoDate(input.manualVerifiedAt))blockers.push('manual verification timestamp');
  requireText('manualVerifiedBy','manual verifier');

  const verified=blockers.length===0;
  return {
    version:'1.0',
    verified,
    evidenceStatus:verified?'MANUALLY_VERIFIED_QUOTE':'QUOTE_INCOMPLETE',
    landedCostEligible:verified,
    blockers,
    policy:'Fail closed. Only a complete, directly sourced, manually verified commercial quote may become landed-cost eligible. Missing fields remain unknown and are never inferred from public listing data.'
  };
}
