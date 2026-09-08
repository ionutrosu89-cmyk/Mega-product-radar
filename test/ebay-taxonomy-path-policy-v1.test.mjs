import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyEbayTaxonomyPath,EBAY_TAXONOMY_PATH_POLICY} from '../ebay-taxonomy-path-policy-v1.js';

const candidate=(categoryName,path)=>({categoryName,path:path.map(categoryName=>({categoryName}))});

test('policy covers all 25 MPR niches and never auto-activates',()=>{
  assert.equal(EBAY_TAXONOMY_PATH_POLICY.nicheCount,25);
  assert.equal(EBAY_TAXONOMY_PATH_POLICY.autoActivation,false);
});

test('AUTO rejects toy/model vehicle Accessories despite lexical match',()=>{
  const result=classifyEbayTaxonomyPath('AUTO',candidate('Accessories',['Toys & Hobbies','Diecast & Toy Vehicles','Parts & Accessories']));
  assert.equal(result.accepted,false);
  assert.equal(result.decision,'PATH_DOMAIN_MISMATCH');
});

test('AUTO accepts a real eBay Motors car parts path',()=>{
  const result=classifyEbayTaxonomyPath('AUTO_ACCESORII',candidate('Interior Parts & Accessories',['eBay Motors','Parts & Accessories','Car & Truck Parts & Accessories']));
  assert.equal(result.accepted,true);
  assert.equal(result.matchedDomain,'AUTO');
});

test('CALATORII rejects German rice/food path even when Reis matches query text',()=>{
  const result=classifyEbayTaxonomyPath('CALATORII',candidate('Reis',['Lebensmittel & Getränke','Nahrungsmittel','Reis & Getreide']));
  assert.equal(result.accepted,false);
  assert.equal(result.decision,'PATH_DOMAIN_MISMATCH');
});

test('CALATORII accepts luggage and travel path',()=>{
  const result=classifyEbayTaxonomyPath('CALATORII',candidate('Travel Accessories',['Travel','Luggage','Travel Accessories']));
  assert.equal(result.accepted,true);
  assert.equal(result.matchedDomain,'TRAVEL');
});

test('FITNESS_ACASA rejects essential oils path',()=>{
  const result=classifyEbayTaxonomyPath('FITNESS_ACASA',candidate('Essential Oils',['Health & Beauty','Aromatherapy','Essential Oils']));
  assert.equal(result.accepted,false);
});
