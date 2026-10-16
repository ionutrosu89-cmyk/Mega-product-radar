export function betaProductFlowTested(product,watchlistStatus){
  return Boolean(String(product??'').trim())&&['yes','no'].includes(String(watchlistStatus??'').trim());
}

export function buildBetaStudyMetadata(values){
  const product=String(values.get('product')||'').trim().slice(0,160);
  const answer=name=>String(values.get(name)||'');
  const understoodStatus=answer('understood'),usefulnessStatus=answer('useful');
  const watchlistStatus=answer('watchlist'),interventionStatus=answer('intervention');
  if(![understoodStatus,usefulnessStatus,watchlistStatus].every(value=>['yes','no','untested','unavailable'].includes(value))||!['yes','no','untested'].includes(interventionStatus)){
    throw new Error('Completează toate întrebările; poți alege „Nu am testat” sau „Indisponibil”.');
  }
  if(['yes','no'].includes(watchlistStatus)&&!product){
    throw new Error('Numește produsul verificat ca să putem evalua rezultatul watchlist-ului.');
  }
  const productFlowTested=betaProductFlowTested(product,watchlistStatus);
  const result=status=>productFlowTested&&['yes','no'].includes(status)?status==='yes':null;
  return {
    studyVersion:'STABILIZATION_2',product:product||null,productFlowTested,
    understoodStatus,usefulnessStatus,watchlistStatus,interventionStatus,
    understoodEvidence:result(understoodStatus),useful:result(usefulnessStatus),
    completedWatchlist:result(watchlistStatus),
    completedIntervention:interventionStatus==='untested'?null:interventionStatus==='yes'
  };
}
