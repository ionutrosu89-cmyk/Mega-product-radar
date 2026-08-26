# Mega Product Radar — P1 Commercial Identity Migration V1

## Objective
Decision-critical commercial records must be keyed by `canonicalProductId`. `productName` is display metadata only.

## Compatibility rule
Legacy local records keyed by normalized product title remain readable during migration, but they are explicitly `LEGACY_LABEL_FALLBACK` and cannot satisfy Supplier, Economics, TEST or BUY decision gates.

## Canonical write rule
Any new decision-critical supplier, landed-cost, RFQ, portfolio or feedback write must carry a valid canonical UUID before it can become decision eligible.

## Migration order
1. Shared commercial identity bridge and tests.
2. Supplier quote persistence and Supplier Gate consumers.
3. Landed cost persistence and Economics Gate consumers.
4. RFQ / Sourcing Ops private records.
5. Portfolio / Feedback Loop records.
6. Remove title-key decision fallbacks after backfill coverage is verified.

## Safety
- No title collision can merge commercial evidence.
- Legacy title fallback is read-only compatibility.
- Missing canonical identity fails closed for decision-critical writes.
- No identity migration grants purchase authority.
- No paid provider execution is introduced by this migration.
