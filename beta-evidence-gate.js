export function evaluateBetaEvidence({sessions=[],technicalChecksPassed=false,criticalIssues=0,confirmedProductFlow=false}={}){
 const unique=new Map();for(const s of sessions){if(s.userId&&s.realParticipant===true)unique.set(s.userId,s);}
 const rows=[...unique.values()],count=rows.length;
 const ratio=key=>count?rows.filter(x=>x[key]===true).length/count:null;
 const metrics={participants:count,understanding:ratio('understoodEvidence'),usefulness:ratio('useful'),watchlistSuccess:ratio('completedWatchlist')};
 const blockers=[];if(!technicalChecksPassed)blockers.push('TECHNICAL_ACCEPTANCE_MISSING');if(criticalIssues>0)blockers.push('CRITICAL_ISSUES_OPEN');
 if(!confirmedProductFlow)blockers.push('CONFIRMED_PRODUCT_FLOW_MISSING');if(count<5)blockers.push('FIVE_REAL_PARTICIPANTS_REQUIRED');
 if(!(metrics.understanding>=.8))blockers.push('EVIDENCE_UNDERSTANDING_BELOW_80_PERCENT');if(!(metrics.usefulness>=.6))blockers.push('USEFULNESS_BELOW_60_PERCENT');if(!(metrics.watchlistSuccess>=.8))blockers.push('WATCHLIST_ACCEPTANCE_BELOW_80_PERCENT');
 return {metrics,blockers,decision:blockers.length?'CONTINUE_FREE_BETA':'READY_FOR_HUMAN_LAUNCH_REVIEW',paidBillingEnabled:false,automaticExpansion:false};
}
