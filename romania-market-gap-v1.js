const num=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const bool=v=>v===true;

function demandScore({searchVolume,trendGrowthPct,providerVerified=false}={}){
  const volume=num(searchVolume);
  const growth=num(trendGrowthPct);
  if(volume===null&&growth===null)return null;
  const volumeScore=volume===null?0:clamp(Math.log10(Math.max(1,volume))*25);
  const growthScore=growth===null?0:clamp(growth<=0?0:growth>=100?100:growth);
  const score=volume!==null&&growth!==null?volumeScore*0.7+growthScore*0.3:volume!==null?volumeScore:growthScore*0.6;
  return Number(clamp(score+(providerVerified?5:0)).toFixed(1));
}

function competitionScore({sellerCount,listingCount,saturationScore,competitionVerified=false}={}){
  const sellers=num(sellerCount),listings=num(listingCount),sat=num(saturationScore);
  if(sellers===null&&listings===null&&sat===null)return null;
  const sellerPressure=sellers===null?null:clamp(sellers>=60?100:sellers/60*100);
  const listingPressure=listings===null?null:clamp(listings>=200?100:listings/200*100);
  const parts=[sellerPressure,listingPressure,sat===null?null:clamp(sat)].filter(x=>x!==null);
  const pressure=parts.reduce((a,b)=>a+b,0)/parts.length;
  const opportunity=100-pressure;
  return Number(clamp(opportunity+(competitionVerified?3:0)).toFixed(1));
}

export function calculateRomaniaMarketGap({globalTrend={},romaniaDemand={},romaniaCompetition={}}={}){
  const globalScore=num(globalTrend.score);
  const globalConfidence=num(globalTrend.confidence);
  const roDemand=demandScore(romaniaDemand);
  const roCompetitionOpportunity=competitionScore(romaniaCompetition);

  const blockers=[];
  if(globalScore===null)blockers.push('GLOBAL_TREND_MISSING');
  if(globalConfidence===null||globalConfidence<40)blockers.push('GLOBAL_TREND_CONFIDENCE_LOW');
  if(roDemand===null)blockers.push('ROMANIA_DEMAND_MISSING');
  if(roCompetitionOpportunity===null)blockers.push('ROMANIA_COMPETITION_MISSING');

  const evidence={
    globalTrendObserved:globalScore!==null,
    globalTrendConfidence:globalConfidence,
    romaniaDemandObserved:roDemand!==null,
    romaniaDemandProviderVerified:bool(romaniaDemand.providerVerified),
    romaniaCompetitionObserved:roCompetitionOpportunity!==null,
    romaniaCompetitionVerified:bool(romaniaCompetition.competitionVerified)
  };

  if(blockers.length){
    return {
      status:'INCOMPLETE',score:null,band:'UNKNOWN',blockers,evidence,
      components:{globalTrend:globalScore,romaniaDemand:roDemand,romaniaCompetitionOpportunity:roCompetitionOpportunity},
      evidenceClass:'DERIVED_FROM_OBSERVED_INPUTS',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    };
  }

  const confidenceWeight=clamp(globalConfidence)/100;
  const raw=globalScore*0.35+roDemand*0.35+roCompetitionOpportunity*0.30;
  const adjusted=raw*(0.75+0.25*confidenceWeight);
  const score=Number(clamp(adjusted).toFixed(1));
  const band=score>=80?'VERY_HIGH':score>=65?'HIGH':score>=50?'MEDIUM':score>=35?'LOW':'VERY_LOW';
  const verification=evidence.romaniaDemandProviderVerified&&evidence.romaniaCompetitionVerified?'STRONG_LOCAL_EVIDENCE':'PARTIAL_LOCAL_EVIDENCE';

  return {
    status:'READY',score,band,verification,blockers:[],evidence,
    components:{globalTrend:globalScore,romaniaDemand:roDemand,romaniaCompetitionOpportunity:roCompetitionOpportunity},
    policy:'ROMANIA_GAP_IS_OPPORTUNITY_INTELLIGENCE_NOT_VERIFIED_SALES',
    evidenceClass:'DERIVED_FROM_OBSERVED_INPUTS',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  };
}

export function buildRomaniaGapRadar(rows=[]){
  const out=(rows||[]).map(row=>({
    productKey:row.productKey||row.identity||null,
    title:row.title||row.name||null,
    ...calculateRomaniaMarketGap(row)
  }));
  const ready=out.filter(x=>x.status==='READY').sort((a,b)=>b.score-a.score);
  const incomplete=out.filter(x=>x.status!=='READY');
  return {
    total:out.length,ready:ready.length,incomplete:incomplete.length,
    veryHigh:ready.filter(x=>x.band==='VERY_HIGH').length,
    high:ready.filter(x=>x.band==='HIGH').length,
    rows:[...ready,...incomplete],
    policy:'RADAR_ONLY_NO_PURCHASE_AUTHORIZATION',paidCallsTriggered:0,purchaseAuthorized:false
  };
}
