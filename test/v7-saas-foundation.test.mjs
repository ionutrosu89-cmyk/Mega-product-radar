import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {SAAS_CONFIG,isSaasConfigured} from '../saas-config.js';
import {workspaceSlug} from '../workspace-client.js';
import {hasFeature,planByCode,usageRemaining} from '../billing-plans.js';

test('Radar 7 ships unconfigured rather than exposing Supabase credentials',()=>{assert.equal(SAAS_CONFIG.mode,'FOUNDATION');assert.equal(isSaasConfigured(SAAS_CONFIG),false);assert.equal(SAAS_CONFIG.supabaseAnonKey,'');});
test('workspace slug is stable and tenant safe',()=>{assert.equal(workspaceSlug('Red Commerce România'),'red-commerce-romania');assert.ok(workspaceSlug('***').length>0);});
test('subscription-ready plan limits are deterministic',()=>{assert.equal(planByCode('PRO').monthlyPriceEur,39);assert.equal(hasFeature('STARTER','SUPPLIERS'),false);assert.equal(hasFeature('PRO','SUPPLIERS'),true);assert.equal(usageRemaining('STARTER',12),18);});
test('Supabase schema contains workspace tenant boundary and RLS',async()=>{const sql=await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');assert.match(sql,/workspace_members/);assert.match(sql,/enable row level security/);assert.match(sql,/is_workspace_member/);assert.doesNotMatch(sql,/service[_ -]?role/i);});
