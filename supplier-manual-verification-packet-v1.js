const PRESENT = v => v !== null && v !== undefined && v !== '';
const TRUE = v => v === true;
const TEXT = v => String(v ?? '').trim();

const REQUIRED_CORE = [
  ['SUPPLIER_IDENTITY', r => PRESENT(r.supplierKey) && PRESENT(r.supplierDisplayName)],
  ['PRODUCT_IDENTITY', r => PRESENT(r.productKey) && (PRESENT(r.model) || PRESENT(r.productSpecificationRef))],
  ['QUOTE_PROVENANCE', r => PRESENT(r.sourceType) && PRESENT(r.quoteCapturedAt) && PRESENT(r.quoteDocumentRef)],
  ['MOQ_OR_QUANTITY', r => Number.isFinite(Number(r.quantity)) && Number(r.quantity) > 0],
  ['UNIT_PRICE', r => Number.isFinite(Number(r.unitPrice)) && Number(r.unitPrice) > 0],
  ['CURRENCY', r => PRESENT(r.currency)],
  ['INCOTERM_DDP_BASIS', r => TRUE(r.ddpIncludesVatDutyClearanceDelivery) && Number.isFinite(Number(r.ddpTotal)) && Number(r.ddpTotal) > 0],
  ['LEAD_TIME', r => Number.isFinite(Number(r.productionLeadDays)) || Array.isArray(r.deliveryWindowDays) || Number.isFinite(Number(r.deliveryWorkingDays))],
  ['PACKAGE_WEIGHT', r => Number.isFinite(Number(r.grossWeightKg)) && Number(r.grossWeightKg) > 0],
  ['PACKAGE_DIMENSIONS', r => Array.isArray(r.cartonCm) && r.cartonCm.length === 3 && r.cartonCm.every(x => Number(x) > 0)],
  ['SAMPLE_TERMS', r => Number.isFinite(Number(r.samplePriceUsd)) || PRESENT(r.sampleTerms)],
  ['COMPLIANCE_BASIS', r => PRESENT(r.compliance?.status) && !['CONFLICTING_SUPPLIER_STATEMENTS','UNKNOWN','PENDING'].includes(String(r.compliance?.status).toUpperCase())],
];

const REQUIRED_MANUAL = [
  'supplierLegalIdentityVerified',
  'productSpecificationMatched',
  'quoteDocumentReviewed',
  'commercialTermsReconfirmed',
  'ddpResponsibilityVerified',
  'complianceDocumentsReviewed',
  'reviewedByHuman',
];

export function buildSupplierVerificationPacket(record = {}) {
  const missingCore = REQUIRED_CORE.filter(([, test]) => !test(record)).map(([key]) => key);
  const manual = record.manualVerification || {};
  const missingManual = REQUIRED_MANUAL.filter(key => !TRUE(manual[key]));
  const complianceConflict = String(record.compliance?.status || '').toUpperCase() === 'CONFLICTING_SUPPLIER_STATEMENTS';
  const documentedReady = missingCore.length === 0 && !complianceConflict;
  const manuallyVerified = documentedReady && missingManual.length === 0;

  return {
    version: '1.0',
    productKey: record.productKey ?? null,
    supplierKey: record.supplierKey ?? null,
    supplierDisplayName: record.supplierDisplayName ?? null,
    currentEvidenceLevel: record.evidenceLevel ?? 'UNKNOWN',
    targetEvidenceLevel: manuallyVerified ? 'MANUALLY_VERIFIED' : documentedReady ? 'DOCUMENTED' : 'SUPPLIER_STATED',
    documentedReady,
    manuallyVerified,
    blockers: [
      ...missingCore.map(code => ({ code, type: 'MISSING_DOCUMENTED_EVIDENCE' })),
      ...(complianceConflict ? [{ code: 'COMPLIANCE_CONFLICT_UNRESOLVED', type: 'CONFLICTING_EVIDENCE' }] : []),
      ...missingManual.map(code => ({ code, type: 'MANUAL_REVIEW_REQUIRED' })),
    ],
    verificationChecklist: REQUIRED_MANUAL.map(code => ({ code, passed: TRUE(manual[code]) })),
    economicsEligible: manuallyVerified,
    finalStageEligibleFromSupplierEvidence: manuallyVerified,
    purchaseAuthorized: false,
    verifiedSalesClaim: false,
    notes: TEXT(record.compliance?.notes) || null,
  };
}

export function buildSupplierVerificationPackets(records = []) {
  const packets = records.map(buildSupplierVerificationPacket);
  return {
    version: '1.0',
    policy: 'SUPPLIER_STATED_NEVER_EQUALS_VERIFIED; DOCUMENTS_AND_HUMAN_REVIEW_REQUIRED; NO_PURCHASE_AUTHORITY',
    stats: {
      total: packets.length,
      documentedReady: packets.filter(x => x.documentedReady).length,
      manuallyVerified: packets.filter(x => x.manuallyVerified).length,
      economicsEligible: packets.filter(x => x.economicsEligible).length,
    },
    packets,
    purchaseAuthorized: false,
  };
}
