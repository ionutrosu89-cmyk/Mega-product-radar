import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "manifest.json",
  "netlify.toml",
  "package.json",
  "products.json",
  "netlify/functions/radar-data.mjs",
  "netlify/functions/radar-health.mjs",
  "netlify/functions/radar-scan-background.mjs",
  "netlify/functions/radar-schedule.mjs",
  "netlify/functions/radar-trigger.mjs"
];

for (const file of requiredFiles) await access(path.join(root, file), constants.R_OK);
for (const file of ["manifest.json", "package.json", "products.json"]) JSON.parse(await readFile(path.join(root, file), "utf8"));

const products = JSON.parse(await readFile(path.join(root, "products.json"), "utf8"));
if (!Array.isArray(products) || products.length === 0) throw new Error("products.json must contain a non-empty array");
const requiredProductFields = ["name", "cat", "chinaMin", "chinaMax", "landed", "sell", "gap", "score", "markets"];
for (const [index, product] of products.entries()) {
  const missing = requiredProductFields.filter((field) => !(field in product));
  if (missing.length) throw new Error(`products.json item ${index} is missing: ${missing.join(", ")}`);
}

const functionDirectory = path.join(root, "netlify", "functions");
const functionFiles = (await readdir(functionDirectory, { recursive: true })).filter((file) => file.endsWith(".mjs")).sort();
const expectedFunctions = ["radar-data.mjs", "radar-health.mjs", "radar-scan-background.mjs", "radar-schedule.mjs", "radar-trigger.mjs"].sort();
if (functionFiles.length !== expectedFunctions.length || expectedFunctions.some((file) => !functionFiles.includes(file))) throw new Error(`Unexpected Netlify Function layout: ${functionFiles.join(", ")}`);

for (const file of expectedFunctions) {
  const result = spawnSync(process.execPath, ["--check", path.join(functionDirectory, file)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed for ${file}`);
}
console.log(`Project check passed: ${products.length} products, ${expectedFunctions.length} Netlify Functions.`);
