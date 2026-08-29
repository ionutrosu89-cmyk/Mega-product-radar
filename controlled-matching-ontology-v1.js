const clean=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

const FORM_FACTOR_ALIASES=new Map([
  ['desktop','desktop organizer'],
  ['desktop organizer','desktop organizer'],
  ['desk organizer','desktop organizer'],
  ['tabletop organizer','desktop organizer']
]);

const FUNCTION_ALIASES=new Map([
  ['organize desk supplies','document and stationery organization'],
  ['desk supplies organization','document and stationery organization'],
  ['document and stationery organization','document and stationery organization'],
  ['office supplies organization','document and stationery organization']
]);

export function canonicalFormFactor(value){
  const key=clean(value);return key?(FORM_FACTOR_ALIASES.get(key)??key):null;
}

export function canonicalPrimaryFunction(value){
  const key=clean(value);return key?(FUNCTION_ALIASES.get(key)??key):null;
}

export const ControlledMatchingOntologyV1Policy=Object.freeze({
  deterministicAliasesOnly:true,
  semanticModelUsed:false,
  hardMismatchPolicyChanged:false,
  screeningThresholdChanged:false,
  unknownEqualsZero:false
});
