# Quote Negotiation Engine

This layer compares only **manually verified supplier quotes** against the internal Target Cost Envelope.

It is deliberately conservative:

- product price + quoted bulk freight is only a **direct quote cost proxy**, never landed cost;
- foreign currencies require an explicit FX-to-RON rate;
- missing fields fail closed;
- customs, broker, compliance, insurance, local handling, VAT treatment and other import costs remain unknown until confirmed;
- `POTENTIALLY_FEASIBLE_PENDING_LANDED_COST` means only that the quoted product + freight fit below the current maximum landed-cost ceiling;
- `NEGOTIATE_DOWN` means the direct quoted costs slightly exceed the ceiling and a supplier-unit target can be calculated;
- `REJECT_ECONOMICS` means even the direct quoted costs exceed the ceiling too much before import extras are added;
- this engine never sets confirmed landed cost and never grants TEST or BUY permission.

For the first sourcing pilot, use the same sell-price scenarios already captured in the RFQ economics envelope. Keep the ceiling private from suppliers; ask for their best price first, then counter only if needed.
