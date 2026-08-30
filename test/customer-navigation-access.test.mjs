import test from 'node:test';
import assert from 'node:assert/strict';
import {customerNavigationAccess,customerNavigationHref} from '../customer-navigation-access.js';
import {planByCode} from '../billing-plans.js';

test('locked commercial navigation follows the plan matrix',()=>{
  assert.equal(customerNavigationAccess('FREE','commercial-radar.html').allowed,false);
  assert.equal(customerNavigationAccess('DISCOVER','commercial-radar.html').allowed,false);
  assert.equal(customerNavigationAccess('RADAR','commercial-radar.html').allowed,true);
  assert.equal(customerNavigationAccess('RADAR','commercial-watchlist.html').allowed,true);
  assert.equal(customerNavigationAccess('RADAR','commercial-launch.html').allowed,false);
  assert.equal(customerNavigationAccess('LAUNCH','commercial-launch.html').allowed,true);
  assert.equal(customerNavigationAccess('LAUNCH','academy.html').allowed,true);
});

test('locked routes fail into the correct pricing upgrade instead of the paid page',()=>{
  assert.equal(customerNavigationHref('FREE','commercial-radar.html'),'pricing.html?upgrade=RADAR&from=commercial-radar.html');
  assert.equal(customerNavigationHref('DISCOVER','commercial-watchlist.html'),'pricing.html?upgrade=RADAR&from=commercial-watchlist.html');
  assert.equal(customerNavigationHref('RADAR','commercial-launch.html'),'pricing.html?upgrade=LAUNCH&from=commercial-launch.html');
  assert.equal(customerNavigationHref('RADAR','home.html'),'home.html');
});

test('commercial pricing remains locked',()=>{
  assert.equal(planByCode('FREE').monthlyPriceEur,0);
  assert.equal(planByCode('DISCOVER').monthlyPriceEur,17.9);
  assert.equal(planByCode('RADAR').monthlyPriceEur,29);
  assert.equal(planByCode('LAUNCH').monthlyPriceEur,89);
});
