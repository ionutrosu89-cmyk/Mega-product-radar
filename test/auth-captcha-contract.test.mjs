import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {isCaptchaConfigured} from '../saas-config.js';

test('captcha public config is fail-closed when provider or site key is missing',()=>{
  assert.equal(isCaptchaConfigured({captchaProvider:'',captchaSiteKey:''}),false);
  assert.equal(isCaptchaConfigured({captchaProvider:'turnstile',captchaSiteKey:''}),false);
  assert.equal(isCaptchaConfigured({captchaProvider:'unknown',captchaSiteKey:'public-site-key'}),false);
  assert.equal(isCaptchaConfigured({captchaProvider:'turnstile',captchaSiteKey:'public-site-key'}),true);
  assert.equal(isCaptchaConfigured({captchaProvider:'hcaptcha',captchaSiteKey:'public-site-key'}),true);
});

test('Supabase auth calls carry captchaToken for login, signup and reset',async()=>{
  const source=await readFile('supabase-client.js','utf8');
  assert.match(source,/signInWithPassword\([^)]*captchaToken/);
  assert.match(source,/signUp\([^)]*captchaToken/);
  assert.match(source,/resetPassword\([^)]*captchaToken/);
  assert.ok((source.match(/captchaToken/g)||[]).length>=6);
});

test('login UI requires a CAPTCHA challenge and blocks auth when public config is absent',async()=>{
  const [html,js,csp]=await Promise.all([
    readFile('login.html','utf8'),
    readFile('login.js','utf8'),
    readFile('netlify.toml','utf8')
  ]);
  assert.match(html,/id="captcha"/);
  assert.match(html,/id="signup" disabled/);
  assert.match(js,/requireCaptchaToken/);
  assert.match(js,/Protecția anti-bot nu este configurată complet/);
  assert.match(js,/challenges\.cloudflare\.com/);
  assert.match(js,/js\.hcaptcha\.com/);
  assert.match(csp,/https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp,/https:\/\/\*\.hcaptcha\.com/);
});
