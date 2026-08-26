import {readdir,readFile} from 'node:fs/promises';

const dir='supabase/migrations';
const files=(await readdir(dir)).filter(x=>x.endsWith('.sql')).sort();
if(!files.length)throw new Error('NO_MIGRATIONS');
if(files[0]!=='20260819_baseline_schema.sql')throw new Error(`BASELINE_MIGRATION_MUST_BE_FIRST:${files[0]}`);
const duplicates=new Set();const seen=new Set();
for(const file of files){const prefix=file.match(/^(\d{8})_/)?.[1];if(!prefix)throw new Error(`INVALID_MIGRATION_NAME:${file}`);const key=file.toLowerCase();if(seen.has(key))duplicates.add(file);seen.add(key);const sql=await readFile(`${dir}/${file}`,'utf8');if(!sql.trim())throw new Error(`EMPTY_MIGRATION:${file}`);}
if(duplicates.size)throw new Error(`DUPLICATE_MIGRATIONS:${[...duplicates].join(',')}`);
const readme=await readFile('supabase/README.md','utf8'),schema=await readFile('supabase/schema.sql','utf8');
if(!/migrations\/.*only supported database source of truth/i.test(readme.replace(/`/g,'')))throw new Error('README_MIGRATION_SOURCE_OF_TRUTH_MISSING');
if(!/LEGACY REFERENCE SNAPSHOT ONLY/.test(schema))throw new Error('SCHEMA_LEGACY_MARKER_MISSING');
for(const required of ['20260826_canonical_product_identity_v1.sql','20260826_record_upsert_optimistic_concurrency_v1.sql','20260826_p0_security_foundation.sql'])if(!files.includes(required))throw new Error(`REQUIRED_MIGRATION_MISSING:${required}`);
console.log(JSON.stringify({ok:true,migrationCount:files.length,first:files[0],last:files.at(-1)},null,2));
