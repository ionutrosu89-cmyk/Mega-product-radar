import {buildEditorialRadarFeed,freshEditorialProducts} from './editorial-radar-v1.js';
import {evaluateFreeReleaseEvidence} from './free-go-live-gate-v1.js';

const sourceHost=url=>new URL(url).hostname.replace(/^www\./,'');
const sameSite=(left,right)=>left===right||left.endsWith(`.${right}`)||right.endsWith(`.${left}`);
const betaEvidenceComplete=product=>{
  const identity=product.evidence.filter(row=>row.type==='IDENTITY');
  const comparable=product.evidence.filter(row=>row.type==='RO_COMPARABLE');
  const demand=product.evidence.filter(row=>row.type==='DEMAND'&&row.demandScope==='PRODUCT_SPECIFIC');
  const listingHosts=new Set([...identity,...comparable].map(row=>sourceHost(row.sourceUrl)));
  return identity.length>0&&comparable.length>0&&demand.some(row=>![...listingHosts].some(host=>sameSite(sourceHost(row.sourceUrl),host)));
};

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
  const betaEligibleCardCount=products.filter(betaEvidenceComplete).length;
  if(!catalogValid||!nicheId||products.length<10||products.length>25||coveredNiches.length!==1||coveredNiches[0]!==nicheId){
    blockers.push('ONE_NICHE_TEN_TO_TWENTY_FIVE_REVIEWED_CARDS_REQUIRED');
  }
  if(betaEligibleCardCount<10||betaEligibleCardCount!==products.length)blockers.push('EACH_CARD_NEEDS_PRODUCT_INTEREST_AND_RO_COMPARABLE');
  if(evidence.editorialBetaScopeApproved!==true)blockers.push('EDITORIAL_BETA_SCOPE_NOT_APPROVED');
  blockers.push(...evaluateFreeReleaseEvidence({study,evidence}));

  return Object.freeze({
    schema:'MPR_EDITORIAL_FREE_BETA_GATE_V1',
    status:blockers.length?'NO_GO':'READY_FOR_HUMAN_REVIEW',
    nicheId:nicheId||null,
    reviewedCardCount:products.length,
    betaEligibleCardCount,
    blockers:Object.freeze(blockers),
    automaticLaunchAllowed:false,
    paidBillingEnabled:false,
  });
}
