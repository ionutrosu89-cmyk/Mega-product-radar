import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loginHtml=fs.readFileSync(new URL('../login.html',import.meta.url),'utf8');
const loginJs=fs.readFileSync(new URL('../login.js',import.meta.url),'utf8');
const accountHtml=fs.readFileSync(new URL('../account.html',import.meta.url),'utf8');
const accountJs=fs.readFileSync(new URL('../account.js',import.meta.url),'utf8');
const supabaseClient=fs.readFileSync(new URL('../supabase-client.js',import.meta.url),'utf8');
const saasShell=fs.readFileSync(new URL('../saas-shell.js',import.meta.url),'utf8');

test('signup UI and validation match the 12-character production password policy',()=>{
  assert.match(loginHtml,/minimum 12 caractere pentru cont nou/);
  assert.match(loginJs,/password\.length<12/);
  assert.match(loginJs,/\[a-z\]/);
  assert.match(loginJs,/\[A-Z\]/);
  assert.match(loginJs,/\[0-9\]/);
});

test('password reset request uses a dedicated recovery destination and neutral response copy',()=>{
  assert.match(supabaseClient,/account\.html\?reset=1/);
  assert.match(loginJs,/Dacă există un cont pentru această adresă/);
});

test('recovery completion requires a valid session, updates password and reconfirms session identity',()=>{
  assert.match(accountHtml,/id="recoveryCard"/);
  assert.match(accountHtml,/id="completeRecovery"/);
  assert.match(supabaseClient,/client\.auth\.updateUser\(\{password\}\)/);
  assert.match(accountJs,/const before=await getCurrentSession\(\)/);
  assert.match(accountJs,/await updatePassword\(password\)/);
  assert.match(accountJs,/const after=await getCurrentSession\(\)/);
  assert.match(accountJs,/after\.user\.id!==before\.user\.id/);
});

test('expired recovery link fails closed without pretending recovery succeeded',()=>{
  assert.match(accountJs,/Link invalid sau expirat/);
  assert.match(accountJs,/Sesiunea de recuperare a expirat/);
});


test('site-url fallback recovery callback is forwarded to the recovery form without exposing tokens',()=>{
  assert.match(saasShell,/recoveryHash\.get\('type'\)==='recovery'/);
  assert.match(saasShell,/new URL\('account\.html\?reset=1',location\.href\)/);
  assert.match(saasShell,/target\.hash=location\.hash/);
  assert.match(saasShell,/location\.replace\(target\.href\)/);
});
