import OpenAI from "openai";
import { getStore } from "@netlify/blobs";
import {freeBetaProviderResponse,paidProviderCallsEnabled} from './_commercial-launch-mode.mjs';

const BUCKETS = [
  "home organization, cleaning tools, kitchen non-electric, travel accessories",
  "pet accessories non-medical, car organization, outdoor practical accessories",
  "kids age 3-6 non-electronic organization, travel, preschool and room products",
  "sports accessories non-medical, recovery accessories without medical claims, hobby storage",
  "beauty organization only (no cosmetics), fashion accessories, wardrobe organization",
  "garden, balcony, DIY organization, seasonal household problem-solvers",
  "office, desk organization, content-creator accessories without batteries/electronics"
];

const EXCLUSIONS = `
Exclude: branded/counterfeit goods, batteries, power banks, complex electrical goods,
cosmetics, supplements, medical devices or medical claims, ingestibles, hazardous chemicals,
weapons, adult products, products with obvious high-return sizing/fit risk, fragile glass,
products whose main value depends on an app, and products that appear to require difficult EU authorization.
`;

const SYSTEM = `
You are a severe senior ecommerce product-research analyst for Romania.
Your job is not to produce attractive ideas. Your job is to reject weak opportunities.
Search the current web and identify product opportunities that are demonstrably selling abroad
but are materially less mature/saturated in Romania.

Target sourcing: China, preferably Alibaba/1688-compatible generic products.
Source cost target: 20-150 RON, with retail target 70-800 RON depending on value.
Prioritize small/light products, strong perceived value, low return risk and low compliance complexity.

You must use evidence, not assumptions. A candidate should normally have:
- at least 2 independent foreign-market demand signals;
- at least 1 Romania competition/price signal;
- at least 1 concrete China sourcing signal;
- a plausible business model after VAT, marketplace commission, returns/ads and inbound logistics.

When exact values are unavailable, be conservative and lower confidence.
Do not fabricate URLs, sales counts, certifications, rankings, supplier age, MOQ or prices.
${EXCLUSIONS}
`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name","category","isKids","age","chinaMin","chinaMax","sellTarget",
          "gap","velocity","demand","competition","logistics","returns","compliance",
          "social","supplier","risk","evidence","roListingsEst","roPriceMin","roPriceMax",
          "sourceStatus","markets","sourcing"
        ],
        properties: {
          name: {type:"string"},
          category: {type:"string"},
          isKids: {type:"boolean"},
          age: {type:"string"},
          chinaMin: {type:"number", minimum:0},
          chinaMax: {type:"number", minimum:0},
          sellTarget: {type:"number", minimum:0},
          gap: {type:"integer", minimum:0, maximum:100},
          velocity: {type:"integer", minimum:0, maximum:100},
          demand: {type:"integer", minimum:0, maximum:100},
          competition: {type:"integer", minimum:0, maximum:100},
          logistics: {type:"integer", minimum:0, maximum:100},
          returns: {type:"integer", minimum:0, maximum:100},
          compliance: {type:"integer", minimum:0, maximum:100},
          social: {type:"integer", minimum:0, maximum:100},
          supplier: {type:"integer", minimum:0, maximum:100},
          risk: {type:"string", enum:["Scăzut","Mediu","Ridicat"]},
          evidence: {type:"string"},
          roListingsEst: {type:"string"},
          roPriceMin: {type:"number", minimum:0},
          roPriceMax: {type:"number", minimum:0},
          sourceStatus: {type:"string", enum:["VERIFIED","PARTIAL"]},
          markets: {
            type:"object",
            additionalProperties:false,
            required:["US","DE","TR","PL","TikTok","RO"],
            properties:{
              US:{type:"integer",minimum:0,maximum:5},
              DE:{type:"integer",minimum:0,maximum:5},
              TR:{type:"integer",minimum:0,maximum:5},
              PL:{type:"integer",minimum:0,maximum:5},
              TikTok:{type:"integer",minimum:0,maximum:5},
              RO:{type:"integer",minimum:0,maximum:5}
            }
          },
          sourcing: {
            type:"array",
            maxItems:3,
            items:{
              type:"object",
              additionalProperties:false,
              required:["market","label","url","price","moq","verified"],
              properties:{
                market:{type:"string",enum:["Alibaba","1688","AliExpress","Other China"]},
                label:{type:"string"},
                url:{type:"string"},
                price:{type:"string"},
                moq:{type:"string"},
                verified:{type:"boolean"}
              }
            }
          }
        }
      }
    }
  }
};

function landedEstimate(p) {
  const sourceMid = (Number(p.chinaMin) + Number(p.chinaMax)) / 2;
  // Conservative lightweight-product heuristic. Later replaced with actual carton/weight quote.
  const inbound = Math.max(12, sourceMid * 0.55);
  return Math.round((sourceMid + inbound + 3) * 100) / 100;
}

function economicsScore(sell, landed) {
  if (!landed || sell <= landed) return 0;
  const net = sell / 1.21;
  const marketplace = sell * 0.17;
  const reserve = sell * 0.08;
  const profit = net - marketplace - reserve - landed;
  const roi = profit / landed * 100;
  return Math.max(0, Math.min(100, roi));
}

function finalScore(p, landed) {
  const econ = economicsScore(p.sellTarget, landed);
  return Math.round(
    p.gap * .25 +
    p.velocity * .15 +
    p.demand * .10 +
    p.competition * .10 +
    p.logistics * .10 +
    p.returns * .05 +
    p.compliance * .05 +
    p.social * .05 +
    p.supplier * .05 +
    econ * .10
  );
}

function slug(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ").trim();
}

async function fallbackProducts(baseUrl) {
  try {
    const r = await fetch(`${baseUrl}/products.json`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch {}
  return [];
}

export default async (req) => {
  if (!paidProviderCallsEnabled(process.env)) return freeBetaProviderResponse();
  const secret = process.env.RADAR_INTERNAL_SECRET;
  if (!secret || req.headers.get("x-radar-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  const store = getStore("mega-radar-live");
  const startedAt = new Date().toISOString();
  await store.set("scan-status", JSON.stringify({ status: "running", startedAt }));
  try {
  const baseUrl = process.env.URL || new URL(req.url).origin;
  const day = Math.floor(Date.now() / 86400000);
  const bucket = BUCKETS[day % BUCKETS.length];

  const openai = new OpenAI();
  const response = await openai.responses.create({
    model: process.env.RADAR_MODEL || "gpt-5",
    store: false,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    input: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `
Today research this product universe: ${bucket}.

Search broadly across signals such as Amazon US/DE, TikTok Shop, Etsy, Walmart, eBay,
Allegro, Kaufland, Trendyol Turkey, Temu/AliExpress and other relevant foreign markets.
Then explicitly compare against Romania using eMAG, Trendyol Romania, Infinity and other
Romanian ecommerce results when available. Finally find China sourcing evidence,
prioritizing concrete Alibaba supplier/product pages and 1688-compatible product types.

Return at most 12 candidates. Prefer 5 excellent products over 12 weak ones.
For "competition", score 100 when Romanian competition is favorable/low and 0 when saturated.
For sourceStatus VERIFIED, the sourcing array must include at least one real direct or highly
specific China sourcing URL with a visible price signal. Otherwise use PARTIAL.
Kids products must be age 3-6 where applicable and should remain compliance-pending.
` }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "mega_radar_candidates",
        strict: true,
        schema
      }
    }
  });

  const parsed = JSON.parse(response.output_text);
  const fresh = (parsed.candidates || []).map(p => {
    const landed = landedEstimate(p);
    const score = finalScore(p, landed);
    const kids = !!p.isKids;
    return {
      name: p.name,
      cat: kids ? `Kids 0–6 • ${p.category}` : p.category,
      chinaMin: Math.round(p.chinaMin * 100)/100,
      chinaMax: Math.round(p.chinaMax * 100)/100,
      landed,
      sell: Math.round(p.sellTarget * 100)/100,
      gap: p.gap,
      velocity: p.velocity,
      demand: p.demand,
      competition: p.competition,
      logistics: p.logistics,
      returns: p.returns,
      compliance: p.compliance,
      social: p.social,
      supplier: p.supplier,
      markets: p.markets,
      status: p.sourceStatus === "VERIFIED" ? "VERIFICAT WEB+CN" : "CANDIDAT LIVE",
      evidence: `${p.evidence} | RO listări est.: ${p.roListingsEst}; interval preț RO observat: ${p.roPriceMin}-${p.roPriceMax} lei.`,
      supplierUrl: p.sourcing?.[0]?.url || "",
      roUrl: "",
      risk: p.risk,
      score,
      verdict: score >= 88 ? "TEST BUY" : score >= 80 ? "SAMPLE" : score >= 72 ? "VALIDATE" : "WATCH",
      sourcing: p.sourcing,
      lastChecked: new Date().toISOString(),
      sourceStatus: p.sourceStatus,
      notes: "LIVE WEB SCAN",
      ...(kids ? { age: p.age || "3–6", kidsGate: "PENDING" } : {})
    };
  }).filter(p =>
    p.chinaMin >= 15 &&
    p.chinaMax <= 180 &&
    p.sell >= 70 &&
    p.sell <= 900 &&
    p.score >= 68 &&
    p.risk !== "Ridicat"
  );

  let previous = [];
  try {
    const raw = await store.get("latest");
    if (raw) previous = JSON.parse(raw).products || [];
  } catch {}

  if (!previous.length) previous = await fallbackProducts(baseUrl);

  const byName = new Map(previous.map(x => [slug(x.name), x]));
  for (const item of fresh) {
    const k = slug(item.name);
    const old = byName.get(k);
    if (!old || (item.score || 0) >= (old.score || 0)) byName.set(k, item);
  }

  const merged = [...byName.values()]
    .sort((a,b)=>(b.score||0)-(a.score||0))
    .slice(0, 150);

  const payload = {
    updatedAt: new Date().toISOString(),
    bucket,
    newCandidates: fresh.length,
    products: merged
  };
  await store.set("latest", JSON.stringify(payload), {
    metadata: { updatedAt: payload.updatedAt, bucket }
  });

  await store.set(`history/${new Date().toISOString().slice(0,10)}`, JSON.stringify({
    updatedAt: payload.updatedAt,
    bucket,
    products: fresh
  }));

  await store.set("scan-status", JSON.stringify({ status: "completed", startedAt, completedAt: payload.updatedAt, newCandidates: fresh.length }));

  console.log(`Mega Radar: ${fresh.length} fresh candidates; ${merged.length} total`);
  } catch (error) {
    await store.set("scan-status", JSON.stringify({ status: "error", startedAt, completedAt: new Date().toISOString(), error: String(error?.message || error) }));
    throw error;
  }
};

export const config = {
  background: true,
  path: "/api/radar/scan",
  method: "POST"
};
