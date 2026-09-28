import {buildEditorialRadarFeed,freshEditorialProducts} from './editorial-radar-v1.js';
import {evaluateFreeReleaseEvidence} from './free-go-live-gate-v1.js';

// This is a separate, deliberately narrow release review. It does not replace
// the 25 x 25 Top25 launch gate or authorize deployment.
export function evaluateEditorialFreeBeta({editorialCandidates,scope={},study={},evidence={}}={},options={}){
  const now=options.now instanceof Date?options.now:new Date();
  const blockers=[];
  let products=[];
  let catalogValid=false;
  try{
    const feed=buildEditorialRadarFeed(editorialCandidates,{now});
    products=freshEditorialProducts(feed,{now});
    catalogValid=true;
  }catch{
    blockers.push('EDITORIAL_CATALOG_INVALID');
  }

  const nicheId=typeof scope.nicheId==='string'?scope.nicheId.trim().toUpperCase():'';
  const coveredNiches=[...new Set(products.map(row=>row.nicheId))];
  if(!catalogValid||!nicheId||products.length<10||products.length>25||coveredNiches.length!==1||coveredNiches[0]!==nicheId){
    blockers.push('ONE_NICHE_TEN_TO_TWENTY_FIVE_REVIEWED_CARDS_REQUIRED');
  }
  if(evidence.editorialBetaScopeApproved!==true)blockers.push('EDITORIAL_BETA_SCOPE_NOT_APPROVED');
  blockers.push(...evaluateFreeReleaseEvidence({study,evidence}));

  return Object.freeze({
    schema:'MPR_EDITORIAL_FREE_BETA_GATE_V1',
    status:blockers.length?'NO_GO':'READY_FOR_HUMAN_REVIEW',
    nicheId:nicheId||null,
    reviewedCardCount:products.length,
    blockers:Object.freeze(blockers),
    automaticLaunchAllowed:false,
    paidBillingEnabled:false,
  });
}
