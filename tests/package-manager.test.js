import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

test('repository uses npm/package-lock.json as the sole deployment lockfile', () => {
  assert.equal(fs.existsSync(new URL('package-lock.json', root)), true);
  assert.equal(fs.existsSync(new URL('pnpm-lock.yaml', root)), false);
  assert.equal(fs.existsSync(new URL('yarn.lock', root)), false);
});
