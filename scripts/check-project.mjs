import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "home5.html","home5.js","alerts.js","sw.js","index.html","radar.html","app.js","manifest.json","netlify.toml","package.json","products.json",
  "purchase-manager.html","purchase-manager.js","landed-cost.html","landed-cost.js","data-vault.html","data-vault.js","data-quality.js",
  "discovery-inbox.html","discovery-inbox.js","discovery-engine.js","discovery-catalogue.json","discovery-themes.json","discovery-live.json","discovery-history.json","discovery-history.js","review-intelligence.js",
  "scripts/build-site.mjs","scripts/qa-mobile.mjs","scripts/discovery-scan.mjs","scripts/data-quality-postprocess.mjs","scripts/run-github-scan.mjs",
  "netlify/functions/radar-data.mjs","netlify/functions/radar-health.mjs","netlify/functions/radar-scan-background.mjs","netlify/functions/radar-schedule.mjs","netlify/functions/radar-trigger.mjs","netlify/functions/radar-sync.mjs"
];
for (const file of requiredFiles) await access(path.join(root, file), constants.R_OK);
for (const file of ["manifest.json","package.json","products.json","discovery-catalogue.json","discovery-themes.json","discovery-live.json","discovery-history.json"]) JSON.parse(await readFile(path.join(root, file), "utf8"));

const index=await readFile(path.join(root,"index.html"),"utf8"),radarPage=await readFile(path.join(root,"radar.html"),"utf8");
if(!index.includes('Command Center 5.7')) throw new Error('Legacy Pages index.html must be the 5.7 Command Center');
if(!radarPage.includes('id="grid"')||!radarPage.includes('app.js')) throw new Error('radar.html must remain the Opportunity Radar page');

const products = JSON.parse(await readFile(path.join(root, "products.json"), "utf8"));
if (!Array.isArray(products) || products.length === 0) throw new Error("products.json must contain a non-empty array");
const requiredProductFields = ["name", "cat", "chinaMin", "chinaMax", "landed", "sell", "gap", "score", "markets"];
for (const [index, product] of products.entries()) {const missing = requiredProductFields.filter((field) => !(field in product));if (missing.length) throw new Error(`products.json item ${index} is missing: ${missing.join(", ")}`);}

const discoveryCatalogue = JSON.parse(await readFile(path.join(root, "discovery-catalogue.json"), "utf8"));
if (!Array.isArray(discoveryCatalogue) || discoveryCatalogue.length < 40) throw new Error("discovery-catalogue.json must contain at least 40 candidate seeds");
const discoveryNames = new Set();
for (const [index, item] of discoveryCatalogue.entries()) {for (const field of ["name","cat","chinaMin","chinaMax","sellTarget"]) if (!(field in item)) throw new Error(`discovery-catalogue.json item ${index} missing ${field}`);const key=String(item.name).trim().toLowerCase();if (discoveryNames.has(key)) throw new Error(`Duplicate discovery candidate: ${item.name}`);discoveryNames.add(key);}
const themes=JSON.parse(await readFile(path.join(root,"discovery-themes.json"),"utf8"));if(!Array.isArray(themes)||themes.length<10)throw new Error("discovery-themes.json must contain at least 10 open-discovery themes");for(const [i,t] of themes.entries())if(!t.query||!t.cat)throw new Error(`discovery theme ${i} missing query/cat`);
const history=JSON.parse(await readFile(path.join(root,"discovery-history.json"),"utf8"));if(!history||typeof history.products!=='object')throw new Error("discovery-history.json must expose products object");

const functionDirectory = path.join(root, "netlify", "functions");
const functionFiles = (await readdir(functionDirectory, { recursive: true })).filter((file) => file.endsWith(".mjs")).sort();
const expectedFunctions = ["radar-data.mjs","radar-health.mjs","radar-scan-background.mjs","radar-schedule.mjs","radar-sync.mjs","radar-trigger.mjs"].sort();
if (functionFiles.length !== expectedFunctions.length || expectedFunctions.some((file) => !functionFiles.includes(file))) throw new Error(`Unexpected Netlify Function layout: ${functionFiles.join(", ")}`);

const syntaxFiles = [
  ...expectedFunctions.map(file => path.join("netlify", "functions", file)),
  "home5.js","alerts.js","sw.js","app.js","purchase-manager.js","landed-cost.js","data-vault.js","data-quality.js","discovery-inbox.js","discovery-engine.js","discovery-history.js","review-intelligence.js",
  path.join("scripts", "build-site.mjs"),path.join("scripts", "qa-mobile.mjs"),path.join("scripts", "discovery-scan.mjs"),path.join("scripts", "data-quality-postprocess.mjs"),path.join("scripts", "run-github-scan.mjs"),path.join("scripts", "web-radar-scan.mjs")
];
for (const file of syntaxFiles) {const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed for ${file}`);}
console.log(`Project check passed: canonical Pages root, ${products.length} radar products, ${discoveryCatalogue.length} discovery seeds, ${themes.length} open themes, ${expectedFunctions.length} Netlify Functions, ${syntaxFiles.length} syntax-checked modules.`);
