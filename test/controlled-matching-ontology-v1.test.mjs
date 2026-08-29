import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalFormFactor,canonicalPrimaryFunction,ControlledMatchingOntologyV1Policy} from '../controlled-matching-ontology-v1.js';

test('canonicalizes desktop organizer aliases deterministically',()=>{
  assert.equal(canonicalFormFactor('desktop'),'desktop organizer');
  assert.equal(canonicalFormFactor('desktop organizer'),'desktop organizer');
  assert.equal(canonicalFormFactor('tabletop organizer'),'desktop organizer');
});

test('canonicalizes desk organization function aliases deterministically',()=>{
  assert.equal(canonicalPrimaryFunction('organize desk supplies'),'document and stationery organization');
  assert.equal(canonicalPrimaryFunction('document and stationery organization'),'document and stationery organization');
});

test('does not invent unknown aliases',()=>{
  assert.equal(canonicalFormFactor('wall mounted'),'wall mounted');
  assert.equal(canonicalPrimaryFunction(null),null);
  assert.equal(ControlledMatchingOntologyV1Policy.screeningThresholdChanged,false);
  assert.equal(ControlledMatchingOntologyV1Policy.hardMismatchPolicyChanged,false);
});
