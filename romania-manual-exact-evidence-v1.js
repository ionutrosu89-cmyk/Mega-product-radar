export function validateRomaniaManualExactEvidence(doc) {
  const errors = [];
  if (!doc || doc.schemaVersion !== 'MPR_ROMANIA_MANUAL_EXACT_EVIDENCE_V1') errors.push('SCHEMA_INVALID');
  if (doc?.candidateAsin !== 'B00INKVS82') errors.push('CANDIDATE_INVALID');
  if (doc?.comparabilityKey !== 'THREE_RING_ROUND_RING_BINDERS') errors.push('COMPARABILITY_KEY_INVALID');
  if (doc?.definitionConfirmed !== true) errors.push('DEFINITION_NOT_CONFIRMED');

  const obs = Array.isArray(doc?.observations) ? doc.observations : [];
  const byPlatform = new Map(obs.map(o => [o?.platform, o]));
  for (const platform of ['EMAG', 'TRENDYOL']) {
    const o = byPlatform.get(platform);
    if (!o) {
      errors.push(`${platform}_MISSING`);
      continue;
    }
    if (o.market !== 'RO') errors.push(`${platform}_MARKET_INVALID`);
    if (typeof o.sourceUrl !== 'string' || !o.sourceUrl.startsWith('https://')) errors.push(`${platform}_SOURCE_URL_INVALID`);
    if (!Number.isFinite(Date.parse(o.observedAt))) errors.push(`${platform}_OBSERVED_AT_INVALID`);
    if (!o.manualReviewer) errors.push(`${platform}_REVIEWER_MISSING`);
    if (o.marketWideReviewed !== true) errors.push(`${platform}_MARKET_WIDE_NOT_CONFIRMED`);
    if (o.comparabilityConfirmed !== true) errors.push(`${platform}_COMPARABILITY_NOT_CONFIRMED`);
    if (!Number.isInteger(o.exactListingCount) || o.exactListingCount < 0) errors.push(`${platform}_EXACT_COUNT_INVALID`);
    if (o.scope !== 'MARKET_WIDE') errors.push(`${platform}_SCOPE_NOT_MARKET_WIDE`);
    if (!o.evidenceNote) errors.push(`${platform}_EVIDENCE_NOTE_MISSING`);
    if (!o.evidenceAttachmentRef) errors.push(`${platform}_ATTACHMENT_REF_MISSING`);
  }

  const p = doc?.policy ?? {};
  if (p.unknownIsZero !== false) errors.push('UNKNOWN_IS_ZERO_POLICY_INVALID');
  if (p.salesEvidenceClass !== 'NOT_VERIFIED_SALES') errors.push('SALES_EVIDENCE_POLICY_INVALID');
  if (p.paidCallsTriggered !== 0 || p.providerSpendEur !== 0) errors.push('SPEND_POLICY_INVALID');
  if (p.purchaseAuthorized !== false) errors.push('PURCHASE_POLICY_INVALID');

  const exactRomaniaGapConfirmed = errors.length === 0;
  return {
    ok: exactRomaniaGapConfirmed,
    errors,
    exactRomaniaGapConfirmed,
    promotionEligible: exactRomaniaGapConfirmed,
    exactCounts: exactRomaniaGapConfirmed ? {
      EMAG: byPlatform.get('EMAG').exactListingCount,
      TRENDYOL: byPlatform.get('TRENDYOL').exactListingCount
    } : null,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    paidCallsTriggered: 0,
    providerSpendEur: 0,
    purchaseAuthorized: false
  };
}
