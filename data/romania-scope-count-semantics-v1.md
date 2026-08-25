# Romania Scope Count Semantics V1

## Rule

Marketplace category/search totals are surface-level counts unless the visible result set has been manually reviewed against the exact canonical MPR niche definition.

- `surfaceItemCountLowerBound`: lower bound for the marketplace surface as displayed.
- `listingCountLowerBound`: lower bound only for the canonical MPR niche after scope confirmation.
- `listingCount`: exact canonical comparable count only after direct-marketplace, market-wide, manual review.

A contaminated surface may preserve `surfaceItemCountLowerBound`, but must keep `listingCountLowerBound=null`, `listingCount=null`, and `comparableScopeConfirmed=false`.

## Current reviewed surfaces

### travel:packing-cubes
Trendyol surface: 656+ items. Visible products include non-canonical travel items such as toiletry/liquid containers. Treat 656+ as surface-only evidence.

### automotive:trunk-organization
Trendyol surface: 512+ items. Visible products include nets, protective covers and generic bags in addition to dedicated trunk organizers. Treat 512+ as surface-only evidence.

### office:laptop-accessories / adjustable laptop stands
Trendyol surface: 1636+ items. Visible products include monitors, docks, cooling pads and adjacent laptop accessories. Treat 1636+ as surface-only evidence.

## Safety

These values are not verified sales, do not authorize purchase, and cannot independently make Romania Gap competition ready.
