export const DEFAULT_POLICY = Object.freeze({
  hardCapEur: 100,
  softStopEur: 80,
  reserveEur: 20,
  maxSingleValidationEur: 3,
  minimumInformationValue: 55,
  minimumOpportunityScore: 25
});

export function freshnessTier({ stage = 'DISCOVERED', watchlist = false, priorityScore = 0 } = {}) {
  if (stage === 'TEST_READY' || stage === 'FINALIST' || (watchlist && priorityScore >= 70)) return 'HOT';
  if (stage === 'VALIDATE' || stage === 'PROMISING' || watchlist) return 'ACTIVE';
  if (stage === 'DISCOVERED' && priorityScore >= 20) return 'DISCOVERY';
  return 'LONG_TAIL';
}

export function freshnessHours(tier) {
  return ({ HOT: 1, ACTIVE: 12, DISCOVERY: 72, LONG_TAIL: 720 })[tier] ?? 720;
}

export function paidEnrichmentDecision({
  spentEur = 0,
  estimatedCostEur = 0,
  informationValue = 0,
  opportunityScore = 0,
  explicitApproval = false,
  policy = DEFAULT_POLICY
} = {}) {
  const projected = Number(spentEur) + Number(estimatedCostEur);
  if (!Number.isFinite(projected) || projected < 0) return { allow: false, reason: 'INVALID_COST' };
  if (estimatedCostEur > policy.maxSingleValidationEur && !explicitApproval) return { allow: false, reason: 'SINGLE_VALIDATION_CAP' };
  if (projected > policy.hardCapEur) return { allow: false, reason: 'HARD_CAP' };
  if (projected > policy.softStopEur && !explicitApproval) return { allow: false, reason: 'SOFT_STOP' };
  if (informationValue < policy.minimumInformationValue) return { allow: false, reason: 'LOW_INFORMATION_VALUE' };
  if (opportunityScore < policy.minimumOpportunityScore) return { allow: false, reason: 'LOW_OPPORTUNITY' };
  return { allow: true, reason: 'ALLOW', projectedEur: Math.round(projected * 10000) / 10000 };
}

export function canonicalFingerprint({ title = '', brand = '', category = '' } = {}) {
  const normalize = value => String(value).toLocaleLowerCase('ro-RO').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return [normalize(brand), normalize(title), normalize(category)].filter(Boolean).join('|');
}
