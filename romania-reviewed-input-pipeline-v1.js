import {appendRomaniaMarketSnapshot} from './romania-market-snapshot-ledger-v1.js';
import {reviewedRomaniaRowToSnapshot} from './romania-manual-review-pack-v1.js';
import {buildRomaniaPromotionReportFromLedger} from './romania-evidence-promotion-report-v1.js';

export function ingestReviewedRomaniaRows({rows=[],existingLedger={version:'1.3',observations:[]}}={}){
  let ledger=existingLedger;
  const results=[];
  let appended=0,duplicates=0,rejected=0;

  for(const raw of rows||[]){
    const converted=reviewedRomaniaRowToSnapshot(raw);
    if(converted.promotableAsExactComparableEvidence!==true){
      rejected+=1;
      results.push({
        nicheKey:raw?.nicheKey||null,
        platform:raw?.platform||null,
        status:'REJECTED_REVIEW_INVALID',
        blockers:converted.validation?.blockers||[],
        purchaseAuthorized:false
      });
      continue;
    }
    const next=appendRomaniaMarketSnapshot(ledger,converted.snapshot);
    const status=next.append?.status||'UNKNOWN';
    ledger=next;
    if(status==='APPENDED')appended+=1;
    else if(status==='DUPLICATE_SKIPPED')duplicates+=1;
    else rejected+=1;
    results.push({
      nicheKey:converted.snapshot.nicheKey,
      platform:converted.snapshot.platform,
      status,
      blockers:status==='APPENDED'||status==='DUPLICATE_SKIPPED'?[]:['LEDGER_APPEND_REJECTED'],
      purchaseAuthorized:false
    });
  }

  return {
    version:'1.1',
    ledger,
    appended,
    duplicates,
    rejected,
    results,
    policy:'MANUALLY_REVIEWED_EXACT_EVIDENCE_ONLY; APPEND_ONLY; FAIL_CLOSED; NO_NETWORK; NO_PURCHASE_AUTHORIZATION',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}

export function runRomaniaReviewedEvidencePipeline({
  queueItems=[],
  reviewedBatch={},
  manualRows=[],
  existingLedger={version:'1.3',observations:[]}
}={}){
  void reviewedBatch;
  const ingestion=ingestReviewedRomaniaRows({rows:manualRows,existingLedger});
  const report=buildRomaniaPromotionReportFromLedger({queueItems,ledger:ingestion.ledger});
  return {
    version:'1.1',
    ingestion:{
      appended:ingestion.appended,
      duplicates:ingestion.duplicates,
      rejected:ingestion.rejected,
      results:ingestion.results
    },
    ledger:ingestion.ledger,
    report,
    promotableNiches:report.rows.filter(x=>x.promotable===true).map(x=>x.nicheKey),
    policy:'OFFLINE_REVIEW_TO_CANONICAL_LEDGER_TO_LEDGER_ONLY_PROMOTION; NO_SIDE_CHANNEL_EVIDENCE; NO_NETWORK; NO_AUTO_PURCHASE; FAIL_CLOSED',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}
