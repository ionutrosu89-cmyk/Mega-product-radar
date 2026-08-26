# P9 — UX Opportunity Detail V1

## Product flow

`Today → Opportunities → Opportunity Detail`

The customer-facing decision surface is deliberately narrower than the underlying intelligence stack. It answers:

1. Is this product worth investigating now?
2. Why?
3. What evidence exists?
4. What is still unknown?
5. What is blocking progress?
6. What is the Economics state?
7. What should be validated next?

## Canonical UX rules

- Opportunity Score and Confidence are always shown separately.
- Missing Opportunity V5 data is UNKNOWN / VALIDATE, never zero or PASS.
- `canonicalProductId` is the decision identity. A row/name fallback may be used only for local UX state and is explicitly marked `ux-only`.
- FINALIST is shown only when the canonical Opportunity V5 result says FINALIST and Trend, Romania Gap, Importability, Supplier and Economics are all PASS with sufficient confidence.
- REVIEW, UNKNOWN or BLOCKED cannot be overridden by a high Opportunity Score.
- Legacy BUY/TEST/HOLD is not a decision authority and is not used to derive the primary UX recommendation.
- The only workflow actions in this layer are `IGNORE`, `WATCH`, and `VALIDATE`.
- This layer cannot emit TEST_READY or BUY_READY.
- This layer cannot authorize purchase, trigger automatic purchase, fabricate verified sales, or trigger paid provider calls.

## Runtime

`opportunity-ux-v1.js` is a truth-preserving presentation adapter over the canonical Opportunity V5 envelope. It does not reconstruct missing evidence from legacy fields.

Both `commercial-radar.html` and `commercial-product.html` now consume this model as the primary customer experience while keeping their existing authenticated URLs.

## Integration verification

This final stacked UX PR is retargeted to `main` only after Opportunity V5 is merged and green. The final integration must keep Opportunity V5 as primary authority, preserve the stricter Economics evidence rule, retain canonical identity and low-confidence fail-closed behavior, and pass the complete npm audit, test and Netlify build pipeline before merge.
