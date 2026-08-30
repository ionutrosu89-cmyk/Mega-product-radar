import {hasFeature,planByCode} from './billing-plans.js';

const RULES=Object.freeze({
  'commercial-radar.html':Object.freeze({feature:'RADAR',upgradePlan:'RADAR'}),
  'commercial-product.html':Object.freeze({feature:'RADAR',upgradePlan:'RADAR'}),
  'commercial-watchlist.html':Object.freeze({feature:'WATCHLIST',upgradePlan:'RADAR'}),
  'commercial-launch.html':Object.freeze({feature:'LAUNCH_PLAN',upgradePlan:'LAUNCH'}),
  'academy.html':Object.freeze({feature:'ACADEMY',upgradePlan:'LAUNCH'})
});

export function customerRouteFile(href=''){
  return String(href||'').split('#')[0].split('?')[0].split('/').pop().toLowerCase();
}

export function customerNavigationAccess(planCode='FREE',href=''){
  const plan=planByCode(planCode),file=customerRouteFile(href),rule=RULES[file]||null;
  if(!rule)return {allowed:true,file,planCode:plan.code,feature:null,upgradePlan:null};
  return {allowed:hasFeature(plan.code,rule.feature),file,planCode:plan.code,feature:rule.feature,upgradePlan:rule.upgradePlan};
}

export function customerNavigationHref(planCode='FREE',href=''){
  const access=customerNavigationAccess(planCode,href);
  if(access.allowed)return href;
  const from=access.file||customerRouteFile(href)||'customer-nav';
  return `pricing.html?upgrade=${encodeURIComponent(access.upgradePlan)}&from=${encodeURIComponent(from)}`;
}

export function customerNavigationLabel(planCode='FREE',href='',label=''){
  const access=customerNavigationAccess(planCode,href);
  return access.allowed?String(label||''):`${String(label||'')} · blocat`;
}
