import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceLinks,evidenceClass,evidenceConfidence} from '../source-connectors.js';

test('Radar 6 exposes direct search links without claiming commercial verification',()=>{const links=sourceLinks('car organizer');assert.ok(links.length>=6);assert.ok(links.every(x=>x.type==='DIRECT_SEARCH'));assert.ok(links.every(x=>x.verifiedCommercial===false));assert.ok(links.some(x=>x.label==='1688'));});

test('Evidence classes keep web proxy separate from verified sources',()=>{assert.equal(evidenceClass({present:true}),'WEB_PROXY');assert.equal(evidenceClass({directVerified:true,present:true}),'DIRECT_VERIFIED');assert.equal(evidenceClass({apiVerified:true,present:true}),'API_VERIFIED');});

test('Evidence confidence is conservative for proxy-only signals',()=>{const low=evidenceConfidence({a:{present:true},b:{present:true}}),high=evidenceConfidence({a:{apiVerified:true},b:{directVerified:true},c:{directVerified:true}});assert.equal(low.level,'LOW');assert.ok(high.score>low.score);});
