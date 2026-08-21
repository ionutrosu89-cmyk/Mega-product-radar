import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const buildScript=fs.readFileSync(path.join(root,'scripts/build-site.mjs'),'utf8');

function importedLocalModules(source){
  const modules=[];
  for(const match of source.matchAll(/(?:import\s+(?:[^'\"]+?\s+from\s+)?|import\()(['\"])(\.\.?\/[^'\"]+)\1/g)){
    modules.push(match[2]);
  }
  return modules;
}

function normalizedModulePath(fromFile,specifier){
  return path.normalize(path.join(path.dirname(fromFile),specifier)).replace(/^\.\//,'');
}

function assertEntryDependenciesArePublished(entry){
  const source=fs.readFileSync(path.join(root,entry),'utf8');
  const imports=importedLocalModules(source).map(spec=>normalizedModulePath(entry,spec));
  assert.ok(imports.length>0,`${entry} should have local module imports`);
  for(const modulePath of imports){
    assert.ok(fs.existsSync(path.join(root,modulePath)),`${modulePath} must exist in repository`);
    const escaped=modulePath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(buildScript,new RegExp(`['\"]${escaped}['\"]`),`${modulePath} must be copied by scripts/build-site.mjs`);
  }
}

test('commercial Home runtime dependencies are included in Netlify build',()=>{
  assertEntryDependenciesArePublished('home.js');
});

test('Discover runtime dependencies are included in Netlify build',()=>{
  assertEntryDependenciesArePublished('discover.js');
});
