import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('build injects global contrast stylesheet and marks light pages',async()=>{
  const build=await readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  assert.match(build,/contrast-fix\.css/);
  assert.match(build,/app-light/);
  assert.match(build,/lightBodyPattern/);
});

test('contrast guard fixes headings, inputs and iOS text selection on light pages',async()=>{
  const css=await readFile(new URL('../contrast-fix.css',import.meta.url),'utf8');
  assert.match(css,/::selection/);
  assert.match(css,/body\.app-light main h1/);
  assert.match(css,/-webkit-text-fill-color:#101828/);
  assert.match(css,/body\.app-light header h1/);
});
