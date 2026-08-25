const up=v=>String(v??'').trim().toUpperCase();

export const ROMANIA_COMPARABILITY_KEY_ALIASES=Object.freeze({
  PACKING_CUBES_SET:'PACKING_CUBES_SET',
  TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS:'PACKING_CUBES_SET',
  CAR_TRUNK_ORGANIZERS:'CAR_TRUNK_ORGANIZERS',
  AUTO_TRUNK_ORGANIZERS:'CAR_TRUNK_ORGANIZERS',
  ADJUSTABLE_LAPTOP_STANDS:'ADJUSTABLE_LAPTOP_STANDS'
});

export function canonicalRomaniaComparabilityKey(value){
  const key=up(value);
  return ROMANIA_COMPARABILITY_KEY_ALIASES[key]||key;
}

export function comparabilityKeysEquivalent(a,b){
  const x=canonicalRomaniaComparabilityKey(a);
  const y=canonicalRomaniaComparabilityKey(b);
  return Boolean(x&&y&&x===y);
}

export const ROMANIA_CANONICAL_COMPARABILITY_KEYS=Object.freeze([
  'PACKING_CUBES_SET',
  'CAR_TRUNK_ORGANIZERS',
  'ADJUSTABLE_LAPTOP_STANDS'
]);
