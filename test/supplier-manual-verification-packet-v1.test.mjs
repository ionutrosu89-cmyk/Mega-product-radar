import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplierVerificationPacket, buildSupplierVerificationPackets } from '../supplier-manual-verification-packet-v1.js';

const complete = {
  productKey:'under-desk-headphone-hanger', supplierKey:'supplier-a', supplierDisplayName:'Supplier A', model:'H1',
  sourceType:'ALIBABA_CHAT_MANUAL', quoteCapturedAt:'2026-08-25T10:00:00Z', quoteDocumentRef:'quote-001',
  quantity:30, unitPrice:3.9, currency:'USD', ddpIncludesVatDutyClearanceDelivery:true, ddpTotal:140,
  productionLeadDays:4, grossWeightKg:8, cartonCm:[40,30,25], samplePriceUsd:20,
  compliance:{status:'DOCUMENTED_APPLICABILITY_REVIEWED'},
  manualVerification:{supplierLegalIdentityVerified:true, productSpecificationMatched:true, quoteDocumentReviewed:true,
    commercialTermsReconfirmed:true, ddpResponsibilityVerified:true, complianceDocumentsReviewed:true, reviewedByHuman:true},
  evidenceLevel:'DOCUMENTED'
};

test('complete documented + human-reviewed evidence can become MANUALLY_VERIFIED but never authorizes purchase', () => {
  const x=buildSupplierVerificationPacket(complete);
  assert.equal(x.manuallyVerified,true);
  assert.equal(x.targetEvidenceLevel,'MANUALLY_VERIFIED');
  assert.equal(x.economicsEligible,true);
  assert.equal(x.purchaseAuthorized,false);
});

test('supplier-stated quote without provenance and manual review fails closed', () => {
  const x=buildSupplierVerificationPacket({productKey:'x', supplierKey:'s', supplierDisplayName:'S', quantity:30, unitPrice:2, currency:'USD'});
  assert.equal(x.manuallyVerified,false);
  assert.equal(x.economicsEligible,false);
  assert.ok(x.blockers.some(b=>b.code==='QUOTE_PROVENANCE'));
  assert.ok(x.blockers.some(b=>b.type==='MANUAL_REVIEW_REQUIRED'));
});

test('conflicting compliance blocks verification even when commercial fields are present', () => {
  const x=buildSupplierVerificationPacket({...complete, compliance:{status:'CONFLICTING_SUPPLIER_STATEMENTS',notes:'CE conflict'}});
  assert.equal(x.manuallyVerified,false);
  assert.equal(x.documentedReady,false);
  assert.ok(x.blockers.some(b=>b.code==='COMPLIANCE_CONFLICT_UNRESOLVED'));
});

test('batch stats count only genuinely verified packets', () => {
  const batch=buildSupplierVerificationPackets([complete,{productKey:'x'}]);
  assert.equal(batch.stats.total,2);
  assert.equal(batch.stats.manuallyVerified,1);
  assert.equal(batch.purchaseAuthorized,false);
});
