import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";

test("only the canonical Netlify Functions are present", async () => {
  const entries = (await readdir("netlify/functions", { recursive: true }))
    .filter((entry) => entry.endsWith(".mjs"))
    .sort();

  assert.deepEqual(entries, [
    "radar-data.mjs",
    "radar-scan-background.mjs",
    "radar-schedule.mjs"
  ]);
});

test("root-level duplicate functions are absent", async () => {
  for (const file of ["radar-data.mjs", "radar-scan-background.mjs", "radar-schedule.mjs"]) {
    await assert.rejects(access(file, constants.F_OK));
  }
});

test("products.json has the frontend's required shape", async () => {
  const products = JSON.parse(await readFile("products.json", "utf8"));
  const required = ["name", "cat", "chinaMin", "chinaMax", "landed", "sell", "gap", "score", "markets"];

  assert.ok(Array.isArray(products));
  assert.ok(products.length > 0);
  for (const product of products) {
    assert.deepEqual(required.filter((field) => !(field in product)), []);
    for (const field of ["chinaMin", "chinaMax", "landed", "sell", "gap", "score"]) {
      assert.equal(Number.isFinite(product[field]), true, `${product.name}: ${field}`);
    }
  }
});

