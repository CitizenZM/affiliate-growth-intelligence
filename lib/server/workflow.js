import { jsPDF } from "jspdf";
import {
  DEFAULT_SECTION_IDS,
  buildDatasetWarnings,
  computeDatasetArtifacts,
  createCapabilities,
  getMetricValue,
  markdownFromSections,
  parseDatasetRows,
  summarizeFindings,
} from "../shared/analysis.js";
import { normalizeFieldMapping } from "../shared/csv.js";
import { openAiJson, openAiWebJson } from "./openai.js";
import { uid } from "./storage.js";

function upsertDatasetRecord(record, extra = {}) {
  return {
    id: record.id || uid("dataupload"),
    created_date: record.created_date || new Date().toISOString(),
    updated_date: new Date().toISOString(),
    status: "pending",
    sections_ready: [],
    processing_progress: 0,
    processing_warnings: [],
    ...record,
    ...extra,
  };
}

function productSignalsFromHtml(html = "") {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ||
    "";
  const headingMatches = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);
  const priceMatches = [...new Set((html.match(/\$[\d,]+(?:\.\d{2})?/g) || []).slice(0, 12))];
  const promoMatches = [...new Set((html.match(/\b(save|sale|discount|bundle|offer|deal|promo|free shipping)\b[^<]{0,80}/gi) || []).slice(0, 12))];
  const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)]
    .map((match) => ({
      href: match[1],
      text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }))
    .filter((item) => item.text)
    .slice(0, 40);

  return { title, description, headings: headingMatches, prices: priceMatches, promos: promoMatches, links: linkMatches };
}

function normalizeDomain(inputUrl = "") {
  try {
    return new URL(inputUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(inputUrl || "unknown-brand").replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function normalizeWebsiteUrl(inputUrl = "", fallbackUrl = "") {
  const trimmed = String(inputUrl || "").trim();
  if (!trimmed) return fallbackUrl;

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed.replace(/^\/+/, "")}`).toString();
    } catch {
      return fallbackUrl;
    }
  }
}

function knownBrandOverride(domain) {
  if (domain !== "insta360.com") return null;
  return {
    brand_name: "Insta360",
    homepage_positioning: "Creator-focused camera brand centered on immersive capture, action shooting, and AI-assisted editing workflows.",
    product_categories: ["360 Cameras", "Action Cameras", "Webcams", "Gimbals"],
    hero_products: ["Insta360 X series", "Ace series", "Link webcams", "Flow gimbals"],
    price_signals: ["Entry accessories around $30", "Core devices span roughly $300-$800"],
    active_promotions: ["Bundles", "Creator-focused campaigns", "Seasonal discounts"],
    creator_language: ["Shoot first, edit later", "Immersive capture", "Creator-friendly workflow", "Adventure storytelling"],
    trust_elements: ["Global brand presence", "Product ecosystem breadth", "Warranty/support messaging", "Official store experience"],
    merchandising_cues: ["Hero SKU merchandising", "Bundle-led conversion", "Use-case-based storytelling", "Cross-sell ecosystem framing"],
    has_promotion: true,
    analysis_pack: {
      source: "known_brand_override",
      analysis_summary:
        "Fallback brand context used because live site access was blocked. Strategy framing emphasizes creator-led content, flagship camera launches, and bundle merchandising.",
    },
  };
}

const PUBLISHER_TYPE_OPTIONS = [
  "content",
  "deal_coupon",
  "loyalty_cashback",
  "social_video",
  "search",
  "tech_sub",
  "other",
];

function normalizePublisherKey(name = "") {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuckDuckGoResults(html = "") {
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];
  return matches.slice(0, 5).map((match) => ({
    url: match[1],
    title: stripHtml(match[2]),
    snippet: stripHtml(match[3]),
  }));
}

function heuristicPublisherType(text = "") {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return null;

  const knownPublisherRules = [
    ["social_video", /\b(kreatornow|creator\.?now|influencer|creator network)\b/],
    ["content", /\b(sovrn|skimbit|skimlinks|digidip|editorial|media network|commerce content)\b/],
    ["loyalty_cashback", /\b(igraal|topcashback|shoop|bing rebates|rebates by microsoft|quidco|befrugal|cashback)\b/],
    ["deal_coupon", /\b(brandreward|pepper|slickdeals|simplycodes|coupon|coupons|deal|deals|voucher)\b/],
    ["tech_sub", /\b(linkgains|partnerize|subnetwork|sub-network|network platform|browser extension|karma shopping|shopping assistant)\b/],
  ];

  for (const [type, pattern] of knownPublisherRules) {
    if (pattern.test(normalized)) {
      return type;
    }
  }

  const rules = [
    ["loyalty_cashback", /\b(cashback|cash back|rebate|rebates|rewards|reward|points|shopping rewards)\b/],
    ["deal_coupon", /\b(coupon|coupons|promo code|promo|discount|discounts|voucher|deal|deals|offers)\b/],
    ["social_video", /\b(influencer|creator|youtube|tiktok|instagram|social|video|streamer)\b/],
    ["search", /\b(search|sem|ppc|comparison shopping|shopping ads)\b/],
    ["tech_sub", /\b(extension|toolbar|subnetwork|sub-network|network|browser extension|technology partner|shopping assistant)\b/],
    ["content", /\b(editorial|content|review|reviews|blog|media|publisher|commerce content|news|guide)\b/],
  ];

  for (const [type, pattern] of rules) {
    if (pattern.test(normalized)) {
      return type;
    }
  }

  return null;
}

async function fetchPublisherSearchResults(publisherName) {
  const query = encodeURIComponent(`"${publisherName}" affiliate publisher type`);
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AffiliateGrowthIntelligenceBot/1.0)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Publisher search failed (${response.status})`);
  }

  return parseDuckDuckGoResults(await response.text());
}

async function classifyPublisherType({ publisherName, searchResults = [] }) {
  const heuristic = heuristicPublisherType(
    [publisherName, ...searchResults.map((item) => `${item.title} ${item.snippet}`)].join(" ")
  );

  try {
    const result = await openAiJson({
      system:
        "You classify affiliate publishers into a single most likely partner type using only supplied search evidence. Prefer 'other' if evidence is weak.",
      prompt: `Classify this affiliate publisher into exactly one type.

Publisher: ${publisherName}
Allowed types: ${PUBLISHER_TYPE_OPTIONS.join(", ")}

Search evidence:
${JSON.stringify(searchResults, null, 2)}

Return the most likely type, confidence, and a short evidence-based reason.`,
      schemaName: "publisher_type_classification",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          publisher_type: { type: "string", enum: PUBLISHER_TYPE_OPTIONS },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["publisher_type", "confidence", "rationale"],
      },
      temperature: 0,
    });

    return {
      publisher_type: result.publisher_type || heuristic || "other",
      confidence: Number.isFinite(result.confidence) ? result.confidence : heuristic ? 0.65 : 0.35,
      rationale: result.rationale || "Classified from search evidence.",
      source: searchResults.length > 0 ? "online_research" : "heuristic",
    };
  } catch {
    return {
      publisher_type: heuristic || "other",
      confidence: heuristic ? 0.65 : 0.25,
      rationale: heuristic ? "Classified from publisher name and search keywords." : "No strong evidence found; defaulted to other.",
      source: heuristic ? "heuristic" : "fallback",
    };
  }
}

async function enrichPublisherTypes({ db, publishers = [] }) {
  const cache = db.PublisherTypeCache || [];
  let enrichedCount = 0;

  for (const publisher of publishers) {
    if (publisher.publisher_type) continue;

    const normalizedKey = normalizePublisherKey(publisher.publisher_name || publisher.publisher_id);
    if (!normalizedKey) continue;

    const cached = cache.find((item) => item.publisher_key === normalizedKey);
    const canReuseCache =
      cached?.publisher_type &&
      cached.source !== "fallback" &&
      Number(cached.confidence ?? 0) >= 0.5;

    if (canReuseCache) {
      publisher.publisher_type = cached.publisher_type;
      publisher.publisher_type_source = cached.source || "cache";
      publisher.publisher_type_confidence = cached.confidence ?? 0.5;
      publisher.publisher_type_rationale = cached.rationale || "";
      enrichedCount += 1;
      continue;
    }

    let searchResults = [];
    try {
      searchResults = await fetchPublisherSearchResults(publisher.publisher_name || publisher.publisher_id);
    } catch {
      // Continue with heuristic fallback.
    }

    const classification = await classifyPublisherType({
      publisherName: publisher.publisher_name || publisher.publisher_id,
      searchResults,
    });

    publisher.publisher_type = classification.publisher_type;
    publisher.publisher_type_source = classification.source;
    publisher.publisher_type_confidence = classification.confidence;
    publisher.publisher_type_rationale = classification.rationale;
    enrichedCount += 1;

    if (cached) {
      Object.assign(cached, {
        publisher_name: publisher.publisher_name || publisher.publisher_id,
        publisher_type: classification.publisher_type,
        confidence: classification.confidence,
        rationale: classification.rationale,
        source: classification.source,
        search_results: searchResults,
        updated_date: new Date().toISOString(),
      });
      continue;
    }

    cache.push({
      id: uid("publishertype"),
      publisher_key: normalizedKey,
      publisher_name: publisher.publisher_name || publisher.publisher_id,
      publisher_type: classification.publisher_type,
      confidence: classification.confidence,
      rationale: classification.rationale,
      source: classification.source,
      search_results: searchResults,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });
  }

  db.PublisherTypeCache = cache;
  return {
    enrichedCount,
    hasPublisherTypeData: publishers.some((publisher) => !!publisher.publisher_type),
  };
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AffiliateGrowthIntelligenceBot/1.0 (+https://vercel.app)",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.text();
}

function buildBrandFallback(domain, pages) {
  const primary = pages[0]?.signals || {};
  const joinedText = [
    primary.title,
    primary.description,
    ...(primary.headings || []),
    ...(primary.promos || []),
  ]
    .join(" ")
    .toLowerCase();
  const categories = [
    ["Travel Bags", /\b(bag|bags|backpack|luggage|travel bag|duffel|organizer|packing cube|toiletry)\b/],
    ["Laptop Bags", /\b(laptop bag|briefcase|work bag|messenger)\b/],
    ["Camera Bags", /\b(camera bag|camera case|photography bag)\b/],
    ["360 Cameras", /\b(360 camera|x5|x4)\b/],
    ["Action Cameras", /\b(action camera|ace pro|ace)\b/],
    ["Webcams", /\b(webcam|streaming camera|link)\b/],
    ["Gimbals", /\b(gimbal|flow)\b/],
  ]
    .filter(([, pattern]) => pattern.test(joinedText))
    .map(([label]) => label);

  return {
    brand_name: domain.split(".")[0].replace(/(^\w)/, (match) => match.toUpperCase()),
    homepage_positioning: primary.description || primary.title || `${domain} product and commerce site`,
    product_categories: categories,
    hero_products: primary.headings?.slice(0, 4) || [],
    price_signals: primary.prices || [],
    active_promotions: primary.promos || [],
    creator_language: primary.headings?.filter((item) => /creator|capture|shoot|share|story/i.test(item)) || [],
    trust_elements: primary.headings?.filter((item) => /warranty|award|shipping|support|official/i.test(item)) || [],
    merchandising_cues: ["Product-led storytelling", "Hero SKU merchandising", "Conversion-oriented homepage"],
    analysis_pack: {
      title: primary.title || "",
      description: primary.description || "",
      pages: pages.map((page) => ({
        url: page.url,
        title: page.signals.title,
        headings: page.signals.headings,
      })),
    },
  };
}

function seedCompetitorsForCategory(categoryName = "") {
  const normalized = String(categoryName || "").toLowerCase();
  if (/travel bag|laptop bag|camera bag|bag|luggage|backpack/.test(normalized)) {
    return [
      { name: "Away", domain: "awaytravel.com" },
      { name: "Béis", domain: "beistravel.com" },
      { name: "CALPAK", domain: "calpaktravel.com" },
      { name: "Samsonite", domain: "samsonite.com" },
    ];
  }
  if (/360 camera|action camera|camera/.test(normalized)) {
    return [
      { name: "GoPro", domain: "gopro.com" },
      { name: "DJI", domain: "dji.com" },
      { name: "AKASO", domain: "akaso.com" },
      { name: "RICOH Theta", domain: "theta360.com" },
    ];
  }
  if (/webcam/.test(normalized)) {
    return [
      { name: "Logitech", domain: "logitech.com" },
      { name: "OBSBOT", domain: "obsbot.com" },
      { name: "Elgato", domain: "elgato.com" },
      { name: "Razer", domain: "razer.com" },
    ];
  }
  if (/gimbal/.test(normalized)) {
    return [
      { name: "DJI", domain: "dji.com" },
      { name: "Zhiyun", domain: "zhiyun-tech.com" },
      { name: "Hohem", domain: "hohem.com" },
      { name: "FeiyuTech", domain: "feiyu-tech.com" },
    ];
  }
  return [];
}

export async function researchBrand(websiteUrl) {
  const domain = normalizeDomain(websiteUrl || "https://www.insta360.com");
  const homepageUrl = websiteUrl || `https://${domain}`;
  let html;
  try {
    html = await fetchPage(homepageUrl);
  } catch (error) {
    const override = knownBrandOverride(domain);
    if (override) return override;
    throw error;
  }
  const homepageSignals = productSignalsFromHtml(html);
  const internalLinks = (homepageSignals.links || [])
    .map((item) => item.href)
    .filter((href) => href && !href.startsWith("mailto:") && !href.startsWith("javascript:"))
    .map((href) => {
      if (href.startsWith("http")) return href;
      return new URL(href, homepageUrl).toString();
    })
    .filter((href) => href.includes(domain))
    .filter((href) => /product|camera|ace|x5|x4|flow|link|store/i.test(href))
    .slice(0, 3);

  const pages = [{ url: homepageUrl, signals: homepageSignals }];
  for (const link of internalLinks) {
    try {
      const pageHtml = await fetchPage(link);
      pages.push({ url: link, signals: productSignalsFromHtml(pageHtml) });
    } catch {
      // Ignore secondary page fetch failures.
    }
  }

  const fallback = buildBrandFallback(domain, pages);

  try {
    const aiResult = await openAiJson({
      system:
        "You are a senior ecommerce and affiliate strategist. Produce grounded brand research from supplied website extracts only. Do not invent facts.",
      prompt: `Analyze this brand website research for affiliate planning.

Domain: ${domain}
Primary URL: ${homepageUrl}

Raw page signals:
${JSON.stringify(pages, null, 2)}

Return structured brand context for affiliate analysis. Keep all claims tied to the supplied page evidence.`,
      schemaName: "brand_research",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          brand_name: { type: "string" },
          homepage_positioning: { type: "string" },
          product_categories: { type: "array", items: { type: "string" } },
          hero_products: { type: "array", items: { type: "string" } },
          price_signals: { type: "array", items: { type: "string" } },
          active_promotions: { type: "array", items: { type: "string" } },
          creator_language: { type: "array", items: { type: "string" } },
          trust_elements: { type: "array", items: { type: "string" } },
          merchandising_cues: { type: "array", items: { type: "string" } },
          analysis_summary: { type: "string" },
        },
        required: [
          "brand_name",
          "homepage_positioning",
          "product_categories",
          "hero_products",
          "price_signals",
          "active_promotions",
          "creator_language",
          "trust_elements",
          "merchandising_cues",
          "analysis_summary",
        ],
      },
      temperature: 0.1,
    });

    return {
      ...fallback,
      ...aiResult,
      has_promotion: (aiResult.active_promotions || []).length > 0,
      analysis_pack: {
        ...fallback.analysis_pack,
        analysis_summary: aiResult.analysis_summary,
      },
    };
  } catch {
    return {
      ...fallback,
      has_promotion: (fallback.active_promotions || []).length > 0,
    };
  }
}

const RESEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SECTION_BLUEPRINTS = {
  0: { title: "Executive Summary - KPI Cockpit", description: "Board-level summary tying performance, category context, competitor pressure, and next actions together." },
  1: { title: "Activation Funnel", description: "Activation health, inactive base, and practical reactivation levers." },
  2: { title: "Revenue Concentration Analysis", description: "Partner concentration, fragility risk, and diversification priorities." },
  3: { title: "Mix Health - Publisher Type Distribution", description: "Publisher-type structure, missing coverage, and mix rebalancing." },
  4: { title: "Efficiency Quadrant", description: "Order- and cost-efficiency story with scaling or cleanup implications." },
  5: { title: "Approval & Transaction Quality", description: "Transaction-quality read on approved, pending, and declined performance." },
  6: { title: "Tier Management", description: "Operating model for tiering and differentiated partner governance." },
  7: { title: "Action Plan Recommendations", description: "30/60/90-day affiliate operating plan grounded in performance and research." },
  8: { title: "Timeline & Roadmap", description: "Sequenced roadmap for activation, recruitment, enablement, and optimization." },
  9: { title: "Data Quality Assessment", description: "Limits, partial coverage, and how they affect confidence." },
  10: { title: "Appendix - Methodology", description: "How the KPIs, research layers, and judgments were derived." },
  11: { title: "Category Landscape", description: "Category demand, merchandising norms, and affiliate-fit signals." },
  12: { title: "Competitor Benchmark", description: "Competitive positioning, product focus, pricing cues, and affiliate implications." },
  13: { title: "Keyword Opportunity Map", description: "Search-intent themes for acquisition, creator content, and comparison capture." },
  14: { title: "Brand Positioning & Creative Hooks", description: "Brand narrative, creator angles, and landing-page content hooks." },
  15: { title: "Research Sources", description: "Supporting citations and confidence notes used in the report." },
};

function buildSearchUrl(query) {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

async function fetchSearchResults(query) {
  const response = await fetch(buildSearchUrl(query), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AffiliateGrowthIntelligenceBot/1.0)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }

  return parseDuckDuckGoResults(await response.text());
}

function isResearchCacheFresh(entry) {
  const timestamp = entry?.payload?.research_generated_at || entry?.updated_date || entry?.created_date;
  return timestamp ? Date.now() - new Date(timestamp).getTime() < RESEARCH_CACHE_TTL_MS : false;
}

function hasRichResearchPayload(payload = {}) {
  return Array.isArray(payload?.competitors) && payload.competitors.length > 0 && Array.isArray(payload?.citations) && payload.citations.length > 0;
}

function uniqueStrings(values = [], limit = 12) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit);
}

function makeCard(label, value, insight = "", tone = "neutral", citationIndices = []) {
  return {
    label,
    value,
    insight,
    tone,
    citation_indices: citationIndices,
  };
}

function makeBlock(type, title, body = "", items = [], meta = "", citationIndices = []) {
  return {
    type,
    title,
    body,
    items: items.filter(Boolean),
    meta,
    citation_indices: citationIndices,
  };
}

function makeTable(title, columns = [], rows = [], note = "", citationIndices = []) {
  return {
    title,
    columns,
    rows,
    note,
    citation_indices: citationIndices,
  };
}

function brandContextFromBundle(researchBundle = {}) {
  return researchBundle?.brand_context || researchBundle || {};
}

function buildMarketSearchQueries(websiteUrl, brandContext) {
  const domain = normalizeDomain(websiteUrl);
  const brandName = brandContext.brand_name || domain.split(".")[0];
  const categories = uniqueStrings(brandContext.product_categories || [], 3);
  const primaryCategory = categories[0] || "consumer camera";

  return uniqueStrings([
    `${brandName} competitors`,
    `${brandName} alternatives`,
    `${brandName} ${primaryCategory} brands`,
    `${primaryCategory} affiliate program examples`,
    `${primaryCategory} best for creators`,
    `${brandName} review comparison`,
  ], 6);
}

function searchPayloadToCitations(searchPayload = []) {
  const seen = new Set();
  const citations = [];

  searchPayload.forEach((entry) => {
    (entry.results || []).forEach((result) => {
      const url = result?.url;
      if (!url || seen.has(url)) return;
      seen.add(url);
      citations.push({
        id: citations.length + 1,
        title: result.title || url,
        url,
        note: entry.query,
        section: "market_research",
      });
    });
  });

  return citations;
}

function fallbackResearchFromSearch({ websiteUrl, brandContext, searchPayload = [] }) {
  const citations = searchPayloadToCitations(searchPayload);
  const primaryCategory = uniqueStrings(brandContext.product_categories || [], 1)[0] || "Consumer electronics";
  const brandName = brandContext.brand_name || normalizeDomain(websiteUrl).split(".")[0];
  const ownDomain = normalizeDomain(websiteUrl);
  const competitors = [];
  const seenDomains = new Set([ownDomain]);

  citations.forEach((citation) => {
    const domain = normalizeDomain(citation.url);
    if (!domain || seenDomains.has(domain) || competitors.length >= 4) return;
    seenDomains.add(domain);
    competitors.push({
      rank: competitors.length + 1,
      name: citation.title.split(/\s[-|:]/)[0] || domain.split(".")[0],
      domain,
      overlap_reason: `Appears in search results related to ${brandName} and ${primaryCategory}.`,
      positioning: "Needs live validation; competitor signal inferred from search overlap.",
      product_focus: [],
      pricing_signals: [],
      promo_signals: [],
      affiliate_takeaway: `Monitor ${domain} messaging and creator-facing offers for overlap with ${brandName}.`,
      confidence: "low",
      citation_ids: [citation.id],
    });
  });

  if (!competitors.length) {
    seedCompetitorsForCategory(primaryCategory).forEach((seed, index) => {
      if (competitors.length >= 4) return;
      competitors.push({
        rank: index + 1,
        name: seed.name,
        domain: seed.domain,
        overlap_reason: `Seeded directional competitor for ${primaryCategory}.`,
        positioning: "Directional competitor placeholder used because live search evidence was limited.",
        product_focus: [],
        pricing_signals: [],
        promo_signals: [],
        affiliate_takeaway: `Use ${seed.name} as a comparison benchmark until live competitor research is available.`,
        confidence: "low",
        citation_ids: [],
      });
    });
  }

  const keywordSeeds = uniqueStrings([
    brandName,
    ...brandContext.hero_products,
    ...brandContext.product_categories,
    `${brandName} review`,
    `${brandName} vs`,
    `${primaryCategory} for creators`,
    `${primaryCategory} deals`,
    `${primaryCategory} coupon`,
  ], 10);

  return {
    category_landscape: {
      category_name: primaryCategory,
      summary: `${brandName} is operating in a ${primaryCategory.toLowerCase()} landscape where creator-led product proof, comparison intent, and promotional windows matter for affiliate conversion.`,
      demand_signals: uniqueStrings([...brandContext.hero_products, ...brandContext.creator_language, ...brandContext.merchandising_cues], 5),
      seasonality: uniqueStrings(brandContext.active_promotions || ["Seasonal promotions and bundle moments shape conversion windows."], 4),
      merchandising_norms: uniqueStrings(brandContext.merchandising_cues || ["Hero SKU storytelling", "Bundle-led conversion"], 4),
      affiliate_fit: uniqueStrings([
        "Creator and review partners are likely important for upper-mid funnel persuasion.",
        "Deal and comparison terms can capture high-intent buyers near purchase.",
        "Hero SKU pages and bundle pages should be affiliate-ready during promo moments.",
      ], 4),
    },
    competitors,
    keyword_landscape: {
      summary: `${brandName} should cover branded, category, competitor comparison, and high-intent modifier keywords to support affiliate recruitment and content briefs.`,
      clusters: [
        {
          cluster_type: "brand",
          theme: `${brandName} branded demand`,
          keywords: keywordSeeds.slice(0, 3),
          intent: "Existing brand demand and review capture.",
          affiliate_angle: "Equip partners with branded reviews, tutorials, and bundle hooks.",
          citation_ids: citations.slice(0, 2).map((item) => item.id),
        },
        {
          cluster_type: "category",
          theme: `${primaryCategory} category discovery`,
          keywords: keywordSeeds.slice(3, 6),
          intent: "Users comparing solutions inside the category.",
          affiliate_angle: "Recruit content and SEO partners who can rank for category-intent content.",
          citation_ids: citations.slice(0, 2).map((item) => item.id),
        },
        {
          cluster_type: "competitor",
          theme: `${brandName} vs alternatives`,
          keywords: keywordSeeds.slice(6, 8),
          intent: "Comparison and switching consideration.",
          affiliate_angle: "Commission creator/comparison content that handles objections and comparisons directly.",
          citation_ids: citations.slice(0, 2).map((item) => item.id),
        },
        {
          cluster_type: "intent_modifier",
          theme: "Promo and purchase-intent modifiers",
          keywords: keywordSeeds.slice(8, 10),
          intent: "Promo-driven conversion capture.",
          affiliate_angle: "Coordinate code, bundle, and landing-page assets for deal moments.",
          citation_ids: citations.slice(0, 2).map((item) => item.id),
        },
      ],
      opportunities: uniqueStrings([
        "Build creator briefs around use-case plus comparison queries.",
        "Treat promo modifiers as a separate landing-page and code-governance workstream.",
        "Use competitor-comparison content to recruit mid-funnel review partners.",
      ], 4),
    },
    affiliate_strategy_pack: {
      executive_angle: `${brandName} should pair affiliate performance management with sharper category and creator positioning so the partner mix can grow without relying only on promo-driven demand.`,
      category_relevance: `${primaryCategory} is driven by product demonstration, creator proof, and promotional merchandising rather than pure coupon volume.`,
      competitor_pressure: competitors.length
        ? `Search overlap suggests ${competitors.map((item) => item.name).join(", ")} are visible comparison points in the category.`
        : "Competitive pressure should be validated with live research; search evidence was limited.",
      creative_hooks: uniqueStrings([...brandContext.creator_language, ...brandContext.hero_products], 5),
      recruitment_priorities: uniqueStrings([
        `Recruit creator, review, and editorial partners around ${primaryCategory.toLowerCase()} use cases.`,
        "Add comparison-focused affiliates who can address switching and evaluation intent.",
        "Keep deal/coupon activity targeted to promo windows rather than as the only growth lever.",
      ], 4),
      content_gaps: uniqueStrings([
        "Comparison content for top alternatives.",
        "Use-case landing pages for hero SKUs.",
        "Promo-ready creative bundles for mid-tier partners.",
      ], 4),
      promo_calendar: uniqueStrings(brandContext.active_promotions || ["Seasonal launch or bundle windows"], 4),
      action_30_days: uniqueStrings([
        "Audit current partner mix against creator, content, comparison, and deal roles.",
        "Brief top partners on hero products, bundles, and proof points.",
      ], 3),
      action_60_days: uniqueStrings([
        "Recruit mid-tier content and comparison partners using category search themes.",
        "Launch refreshed landing pages and promotional toolkits for key windows.",
      ], 3),
      action_90_days: uniqueStrings([
        "Review partner mix shift, concentration trend, and efficiency after recruitment and creative updates.",
        "Institutionalize quarterly category/competitor refreshes for affiliate planning.",
      ], 3),
    },
    citations,
    confidence_notes: [
      "This research bundle used search-result evidence and fallback synthesis where live source access was limited.",
    ],
  };
}

function marketResearchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      category_landscape: {
        type: "object",
        additionalProperties: false,
        properties: {
          category_name: { type: "string" },
          summary: { type: "string" },
          demand_signals: { type: "array", items: { type: "string" } },
          seasonality: { type: "array", items: { type: "string" } },
          merchandising_norms: { type: "array", items: { type: "string" } },
          affiliate_fit: { type: "array", items: { type: "string" } },
        },
        required: ["category_name", "summary", "demand_signals", "seasonality", "merchandising_norms", "affiliate_fit"],
      },
      competitors: {
        type: "array",
        minItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            rank: { type: "number" },
            name: { type: "string" },
            domain: { type: "string" },
            overlap_reason: { type: "string" },
            positioning: { type: "string" },
            product_focus: { type: "array", items: { type: "string" } },
            pricing_signals: { type: "array", items: { type: "string" } },
            promo_signals: { type: "array", items: { type: "string" } },
            affiliate_takeaway: { type: "string" },
            confidence: { type: "string" },
            citation_ids: { type: "array", items: { type: "number" } },
          },
          required: ["rank", "name", "domain", "overlap_reason", "positioning", "product_focus", "pricing_signals", "promo_signals", "affiliate_takeaway", "confidence", "citation_ids"],
        },
      },
      keyword_landscape: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          clusters: {
            type: "array",
            minItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                cluster_type: { type: "string", enum: ["brand", "category", "competitor", "intent_modifier"] },
                theme: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                intent: { type: "string" },
                affiliate_angle: { type: "string" },
                citation_ids: { type: "array", items: { type: "number" } },
              },
              required: ["cluster_type", "theme", "keywords", "intent", "affiliate_angle", "citation_ids"],
            },
          },
          opportunities: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "clusters", "opportunities"],
      },
      affiliate_strategy_pack: {
        type: "object",
        additionalProperties: false,
        properties: {
          executive_angle: { type: "string" },
          category_relevance: { type: "string" },
          competitor_pressure: { type: "string" },
          creative_hooks: { type: "array", items: { type: "string" } },
          recruitment_priorities: { type: "array", items: { type: "string" } },
          content_gaps: { type: "array", items: { type: "string" } },
          promo_calendar: { type: "array", items: { type: "string" } },
          action_30_days: { type: "array", items: { type: "string" } },
          action_60_days: { type: "array", items: { type: "string" } },
          action_90_days: { type: "array", items: { type: "string" } },
        },
        required: ["executive_angle", "category_relevance", "competitor_pressure", "creative_hooks", "recruitment_priorities", "content_gaps", "promo_calendar", "action_30_days", "action_60_days", "action_90_days"],
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            url: { type: "string" },
            note: { type: "string" },
            section: { type: "string" },
          },
          required: ["id", "title", "url", "note", "section"],
        },
      },
      confidence_notes: { type: "array", items: { type: "string" } },
    },
    required: ["category_landscape", "competitors", "keyword_landscape", "affiliate_strategy_pack", "citations", "confidence_notes"],
  };
}

function buildMarketResearchPrompt({ websiteUrl, brandContext, searchPayload, researchMode }) {
  return `Build a research-backed affiliate strategy pack for this brand.

Target website: ${websiteUrl}
Research mode: ${researchMode}

Brand context:
${JSON.stringify(brandContext, null, 2)}

Seed search evidence:
${JSON.stringify(searchPayload, null, 2)}

Requirements:
- Focus on affiliate growth strategy, creator/content relevance, search intent, merchandising, and competitor overlap.
- Assume the affiliate program already exists and needs optimization, not a fresh launch recommendation.
- Auto-discover up to 8 competitors, then keep the top 4 distinct competitors most relevant to the brand/category.
- Produce at least 4 keyword clusters and aim for 8-12 themes across brand, category, competitor, and intent modifier groups.
- Use citations for every major market or competitor claim.
- Do not fabricate search volume, affiliate program economics, or competitor terms if unavailable.
- If evidence is directional, say so in confidence_notes.
- Return only JSON matching the schema.`;
}

function normalizeResearchBundle({ websiteUrl, brandContext, researchMode, cacheHit = false, research = null, searchPayload = [] }) {
  const fallback = fallbackResearchFromSearch({ websiteUrl, brandContext, searchPayload });
  const citationSource = Array.isArray(research?.citations) && research.citations.length ? research.citations : fallback.citations;
  const citations = citationSource.map((citation, index) => ({
    id: Number.isFinite(citation?.id) ? citation.id : index + 1,
    title: citation?.title || citation?.url || `Source ${index + 1}`,
    url: citation?.url || "",
    note: citation?.note || "",
    section: citation?.section || "research",
  })).filter((citation) => citation.url);

  const citationIds = new Set(citations.map((citation) => citation.id));
  const merged = research || fallback;
  const competitors = [...(merged.competitors || []), ...(fallback.competitors || [])].slice(0, 4).map((item, index) => ({
    rank: index + 1,
    name: item?.name || `Competitor ${index + 1}`,
    domain: normalizeDomain(item?.domain || item?.url || ""),
    overlap_reason: item?.overlap_reason || "Competitive overlap inferred from market research.",
    positioning: item?.positioning || "",
    product_focus: uniqueStrings(item?.product_focus || [], 4),
    pricing_signals: uniqueStrings(item?.pricing_signals || [], 4),
    promo_signals: uniqueStrings(item?.promo_signals || [], 4),
    affiliate_takeaway: item?.affiliate_takeaway || "",
    confidence: item?.confidence || "medium",
    citation_ids: (item?.citation_ids || []).filter((id) => citationIds.has(id)),
  }));

  const mergedClusters = [...(merged.keyword_landscape?.clusters || [])];
  for (const cluster of fallback.keyword_landscape?.clusters || []) {
    if (mergedClusters.length >= 8) break;
    if (!mergedClusters.some((item) => item?.cluster_type === cluster.cluster_type)) {
      mergedClusters.push(cluster);
    }
  }
  const clusters = mergedClusters.slice(0, 12).map((cluster) => ({
    cluster_type: cluster?.cluster_type || "category",
    theme: cluster?.theme || "Keyword theme",
    keywords: uniqueStrings(cluster?.keywords || [], 4),
    intent: cluster?.intent || "",
    affiliate_angle: cluster?.affiliate_angle || "",
    citation_ids: (cluster?.citation_ids || []).filter((id) => citationIds.has(id)),
  }));

  const categoryLandscape = {
    category_name: merged.category_landscape?.category_name || fallback.category_landscape.category_name,
    summary: merged.category_landscape?.summary || fallback.category_landscape.summary,
    demand_signals: uniqueStrings(merged.category_landscape?.demand_signals || fallback.category_landscape.demand_signals, 6),
    seasonality: uniqueStrings(merged.category_landscape?.seasonality || fallback.category_landscape.seasonality, 6),
    merchandising_norms: uniqueStrings(merged.category_landscape?.merchandising_norms || fallback.category_landscape.merchandising_norms, 6),
    affiliate_fit: uniqueStrings(merged.category_landscape?.affiliate_fit || fallback.category_landscape.affiliate_fit, 6),
  };

  const strategyPack = {
    executive_angle: merged.affiliate_strategy_pack?.executive_angle || fallback.affiliate_strategy_pack.executive_angle,
    category_relevance: merged.affiliate_strategy_pack?.category_relevance || fallback.affiliate_strategy_pack.category_relevance,
    competitor_pressure: merged.affiliate_strategy_pack?.competitor_pressure || fallback.affiliate_strategy_pack.competitor_pressure,
    creative_hooks: uniqueStrings([...(merged.affiliate_strategy_pack?.creative_hooks || []), ...(fallback.affiliate_strategy_pack.creative_hooks || [])], 6),
    recruitment_priorities: uniqueStrings([...(merged.affiliate_strategy_pack?.recruitment_priorities || []), ...(fallback.affiliate_strategy_pack.recruitment_priorities || [])], 6),
    content_gaps: uniqueStrings([...(merged.affiliate_strategy_pack?.content_gaps || []), ...(fallback.affiliate_strategy_pack.content_gaps || [])], 6),
    promo_calendar: uniqueStrings([...(merged.affiliate_strategy_pack?.promo_calendar || []), ...(fallback.affiliate_strategy_pack.promo_calendar || [])], 6),
    action_30_days: uniqueStrings([...(merged.affiliate_strategy_pack?.action_30_days || []), ...(fallback.affiliate_strategy_pack.action_30_days || [])], 4),
    action_60_days: uniqueStrings([...(merged.affiliate_strategy_pack?.action_60_days || []), ...(fallback.affiliate_strategy_pack.action_60_days || [])], 4),
    action_90_days: uniqueStrings([...(merged.affiliate_strategy_pack?.action_90_days || []), ...(fallback.affiliate_strategy_pack.action_90_days || [])], 4),
  };

  const keywordLandscape = {
    summary: merged.keyword_landscape?.summary || fallback.keyword_landscape.summary,
    clusters,
    opportunities: uniqueStrings(merged.keyword_landscape?.opportunities || fallback.keyword_landscape.opportunities, 6),
  };

  const confidenceNotes = uniqueStrings(merged.confidence_notes || fallback.confidence_notes || [], 6);
  const analysisSummary = uniqueStrings([
    brandContext.analysis_pack?.analysis_summary,
    categoryLandscape.summary,
    strategyPack.executive_angle,
  ], 3).join(" ");

  return {
    ...brandContext,
    research_generated_at: new Date().toISOString(),
    research_mode: researchMode,
    brand_context: {
      ...brandContext,
    },
    category_landscape: categoryLandscape,
    competitors,
    keyword_landscape: keywordLandscape,
    affiliate_strategy_pack: strategyPack,
    citations,
    confidence_notes: confidenceNotes,
    analysis_pack: {
      ...brandContext.analysis_pack,
      analysis_summary: analysisSummary,
      cache_hit: cacheHit,
      search_query_count: searchPayload.length,
    },
  };
}

async function buildResearchBundle({ websiteUrl, brandContext, researchMode = "balanced_live" }) {
  const searchQueries = buildMarketSearchQueries(websiteUrl, brandContext);
  const searchPayload = await Promise.all(
    searchQueries.map(async (query) => {
      try {
        return { query, results: await fetchSearchResults(query) };
      } catch {
        return { query, results: [] };
      }
    })
  );

  const warnings = [];
  let research = null;
  let source = "fallback";

  try {
    research = await openAiWebJson({
      system:
        "You are a senior affiliate growth strategist doing market, category, competitor, and keyword research. Ground every claim in web evidence and return only schema-valid JSON.",
      prompt: buildMarketResearchPrompt({ websiteUrl, brandContext, searchPayload, researchMode }),
      schemaName: "market_research_bundle",
      schema: marketResearchSchema(),
      temperature: 0.1,
    });
    source = "openai_web";
  } catch (error) {
    warnings.push(`Live web research fallback used: ${error.message}`);
    try {
      research = await openAiJson({
        system:
          "You are a senior affiliate growth strategist. Use only the supplied brand context and search-result evidence. Return only schema-valid JSON.",
        prompt: buildMarketResearchPrompt({ websiteUrl, brandContext, searchPayload, researchMode }),
        schemaName: "market_research_bundle_fallback",
        schema: marketResearchSchema(),
        temperature: 0.1,
      });
      source = "search_synthesis";
    } catch (fallbackError) {
      warnings.push(`Search synthesis fallback used: ${fallbackError.message}`);
    }
  }

  const bundle = normalizeResearchBundle({
    websiteUrl,
    brandContext,
    researchMode,
    cacheHit: false,
    research,
    searchPayload,
  });

  if (!bundle.competitors.length) {
    warnings.push("Competitor discovery returned limited evidence. Competitor section will be directional.");
  }
  if ((bundle.keyword_landscape?.clusters || []).length < 4) {
    warnings.push("Keyword clustering is partial because live search evidence was limited.");
  }

  return {
    bundle,
    source,
    warnings,
    search_queries: searchQueries,
    search_result_count: searchPayload.reduce((sum, entry) => sum + (entry.results || []).length, 0),
  };
}

function metricLines(metrics = []) {
  return {
    totalGMV: getMetricValue(metrics, "total_gmv"),
    activeRatio: getMetricValue(metrics, "active_ratio"),
    top10Share: getMetricValue(metrics, "top10_share"),
    orders: getMetricValue(metrics, "total_orders"),
    commission: getMetricValue(metrics, "total_commission"),
    approvalRate: getMetricValue(metrics, "approval_rate"),
    publishersTo50: getMetricValue(metrics, "publishers_to_50pct"),
  };
}

function buildExecutiveCards(metrics, researchBundle) {
  const { totalGMV, activeRatio, top10Share } = metricLines(metrics);
  const strategy = researchBundle?.affiliate_strategy_pack || {};
  return [
    makeCard("Performance Headline", `$${totalGMV.toFixed(2)}`, `Active ratio ${(activeRatio * 100).toFixed(1)}% across the current dataset.`, activeRatio < 0.4 ? "warning" : "good"),
    makeCard("Category Signal", researchBundle?.category_landscape?.category_name || "Category", researchBundle?.category_landscape?.summary || strategy.category_relevance || "", "neutral", researchBundle?.citations?.slice(0, 2).map((item) => item.id) || []),
    makeCard("Competitor Pressure", `${(top10Share * 100).toFixed(1)}% Top10`, strategy.competitor_pressure || "Use competitor research to benchmark where the current mix is under-covered.", top10Share > 0.7 ? "bad" : "warning", researchBundle?.competitors?.flatMap((item) => item.citation_ids || []).slice(0, 2) || []),
    makeCard("Keyword Opportunity", `${(researchBundle?.keyword_landscape?.clusters || []).length} clusters`, researchBundle?.keyword_landscape?.summary || "", "neutral", researchBundle?.keyword_landscape?.clusters?.flatMap((item) => item.citation_ids || []).slice(0, 2) || []),
    makeCard("Priority Actions", "30/60/90", uniqueStrings(strategy.action_30_days || [], 1)[0] || "Prioritize activation, diversification, and creator enablement.", "neutral"),
  ];
}

function tableFromCompetitors(competitors = []) {
  return makeTable(
    "Competitor Snapshot",
    ["Competitor", "Positioning", "Product Focus", "Pricing", "Affiliate Takeaway"],
    competitors.map((item) => [
      item.name,
      item.positioning || "Directional",
      uniqueStrings(item.product_focus || [], 2).join(", "),
      uniqueStrings(item.pricing_signals || [], 2).join(", "),
      item.affiliate_takeaway || "",
    ]),
    competitors.length ? "Competitive snapshot is directional and grounded in live research or cached search evidence." : "No competitive evidence captured.",
    competitors.flatMap((item) => item.citation_ids || []).slice(0, 6)
  );
}

function tableFromKeywordClusters(clusters = []) {
  return makeTable(
    "Keyword Clusters",
    ["Cluster", "Sample Keywords", "Intent", "Affiliate Angle"],
    clusters.map((item) => [
      item.theme,
      uniqueStrings(item.keywords || [], 3).join(", "),
      item.intent || "",
      item.affiliate_angle || "",
    ]),
    clusters.length ? "Keyword themes are grouped for affiliate planning, not for paid search forecasting." : "No keyword themes available.",
    clusters.flatMap((item) => item.citation_ids || []).slice(0, 6)
  );
}

function buildResearchSourceTable(citations = []) {
  return makeTable(
    "Research Sources",
    ["ID", "Title", "URL", "Note"],
    citations.map((citation) => [
      String(citation.id || ""),
      citation.title || "",
      citation.url || "",
      citation.note || "",
    ]),
    citations.length ? "These sources support the category, competitor, and keyword sections." : "No citations available.",
    citations.map((citation) => citation.id)
  );
}

function sectionContext(sectionId, researchBundle = {}, evidenceTables = []) {
  const brandContext = brandContextFromBundle(researchBundle);
  const citations = researchBundle?.citations || [];
  const context = {
    brand_context: brandContext,
    citations,
  };

  switch (sectionId) {
    case 0:
    case 7:
      return {
        ...context,
        category_landscape: researchBundle?.category_landscape,
        competitors: researchBundle?.competitors,
        keyword_landscape: researchBundle?.keyword_landscape,
        affiliate_strategy_pack: researchBundle?.affiliate_strategy_pack,
      };
    case 2:
      return {
        ...context,
        competitors: researchBundle?.competitors,
        affiliate_strategy_pack: researchBundle?.affiliate_strategy_pack,
        evidence: evidenceTables.filter((item) => item.table_key === "topn_table" || item.table_key === "pareto_points"),
      };
    case 3:
      return {
        ...context,
        category_landscape: researchBundle?.category_landscape,
        affiliate_strategy_pack: researchBundle?.affiliate_strategy_pack,
        evidence: evidenceTables.filter((item) => item.table_key === "mix_health_table"),
      };
    case 8:
      return {
        ...context,
        affiliate_strategy_pack: researchBundle?.affiliate_strategy_pack,
      };
    case 11:
      return { ...context, category_landscape: researchBundle?.category_landscape };
    case 12:
      return { ...context, competitors: researchBundle?.competitors };
    case 13:
      return { ...context, keyword_landscape: researchBundle?.keyword_landscape };
    case 14:
      return {
        ...context,
        brand_context: brandContext,
        affiliate_strategy_pack: researchBundle?.affiliate_strategy_pack,
      };
    case 15:
      return {
        ...context,
        confidence_notes: researchBundle?.confidence_notes,
      };
    default:
      return {
        ...context,
        affiliate_strategy_pack: researchBundle?.affiliate_strategy_pack,
      };
  }
}

function buildSectionPrompt({ sectionId, dataset, metrics, evidenceTables, researchBundle, warnings, findings, language = "en" }) {
  const blueprint = SECTION_BLUEPRINTS[sectionId] || SECTION_BLUEPRINTS[0];
  const outputLang = language === "zh" ? "Simplified Chinese" : "English";
  return `Create chapter ${sectionId} for a research-backed affiliate growth report.

Chapter intent:
${JSON.stringify(blueprint, null, 2)}

Dataset:
${JSON.stringify(
    {
      version_label: dataset.version_label,
      website_url: dataset.website_url,
      capabilities: dataset.capabilities,
      warnings,
    },
    null,
    2
  )}

Metrics:
${JSON.stringify(metrics, null, 2)}

Evidence:
${JSON.stringify(evidenceTables, null, 2)}

Research bundle:
${JSON.stringify(sectionContext(sectionId, researchBundle, evidenceTables), null, 2)}

Rule-based findings:
${JSON.stringify(findings, null, 2)}

Instructions:
- Write for an affiliate marketing operator and leadership audience.
- Use only uploaded dataset numbers for performance claims.
- Use only supplied citations for market, category, competitor, and keyword claims.
- Prefer concrete affiliate strategy implications over generic marketing advice.
- If evidence is partial, say so clearly and set research_flags.partial=true.
- Fill summary_cards, content_blocks, tables, citations, and research_flags with useful content; use empty arrays rather than omitting.
- Keep content_md executive-friendly, but use blocks/tables to provide deeper detail.
- Output language: ${outputLang}. All user-facing text fields (title, conclusion, key_findings, summary_cards, content_blocks) MUST be written in ${outputLang}.`;
}

function sectionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      conclusion: { type: "string" },
      content_md: { type: "string" },
      conclusion_status: { type: "string", enum: ["good", "neutral", "warning", "bad"] },
      key_findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["risk", "opportunity"] },
            title: { type: "string" },
            trigger: { type: "string" },
            action: { type: "string" },
            owner: { type: "string" },
            deadline: { type: "string" },
            linkPage: { type: "string" },
          },
          required: ["type", "title", "trigger", "action", "owner", "deadline", "linkPage"],
        },
      },
      summary_cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            insight: { type: "string" },
            tone: { type: "string", enum: ["good", "neutral", "warning", "bad"] },
            citation_indices: { type: "array", items: { type: "number" } },
          },
          required: ["label", "value", "insight", "tone", "citation_indices"],
        },
      },
      content_blocks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["paragraph", "bullet_list", "numbered_list", "callout", "competitor_card", "keyword_cluster", "source_list"] },
            title: { type: "string" },
            body: { type: "string" },
            items: { type: "array", items: { type: "string" } },
            meta: { type: "string" },
            citation_indices: { type: "array", items: { type: "number" } },
          },
          required: ["type", "title", "body", "items", "meta", "citation_indices"],
        },
      },
      tables: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            columns: { type: "array", items: { type: "string" } },
            rows: {
              type: "array",
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
            note: { type: "string" },
            citation_indices: { type: "array", items: { type: "number" } },
          },
          required: ["title", "columns", "rows", "note", "citation_indices"],
        },
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            url: { type: "string" },
            note: { type: "string" },
            section: { type: "string" },
          },
          required: ["id", "title", "url", "note", "section"],
        },
      },
      research_flags: {
        type: "object",
        additionalProperties: false,
        properties: {
          partial: { type: "boolean" },
          uses_live_research: { type: "boolean" },
          cache_hit: { type: "boolean" },
          confidence: { type: "string" },
        },
        required: ["partial", "uses_live_research", "cache_hit", "confidence"],
      },
    },
    required: ["title", "conclusion", "content_md", "conclusion_status", "key_findings", "summary_cards", "content_blocks", "tables", "citations", "research_flags"],
  };
}

function fallbackSection(sectionId, dataset, metrics, warnings, researchBundle) {
  const capabilities = dataset.capabilities || {};
  const brandContext = brandContextFromBundle(researchBundle);
  const findings = summarizeFindings(metrics, brandContext);
  const { totalGMV, activeRatio, top10Share, orders, commission, approvalRate, publishersTo50 } = metricLines(metrics);
  const category = researchBundle?.category_landscape || {};
  const strategy = researchBundle?.affiliate_strategy_pack || {};
  const competitors = researchBundle?.competitors || [];
  const keywordClusters = researchBundle?.keyword_landscape?.clusters || [];
  const citations = researchBundle?.citations || [];
  const sharedFlags = {
    partial: false,
    uses_live_research: citations.length > 0,
    cache_hit: !!researchBundle?.analysis_pack?.cache_hit,
    confidence: researchBundle?.confidence_notes?.length ? "mixed" : "medium",
  };

  const sections = {
    0: {
      title: SECTION_BLUEPRINTS[0].title,
      conclusion: `GMV is $${totalGMV.toFixed(2)}, active ratio is ${(activeRatio * 100).toFixed(1)}%, and top-10 share is ${(top10Share * 100).toFixed(1)}%.`,
      content_md: `The program needs to improve activation while reducing concentration risk. Market context suggests the partner mix should align more closely to ${category.category_name || brandContext.brand_name || "the category"} purchase journeys, creator proof, and comparison intent.`,
      conclusion_status: top10Share > 0.7 ? "bad" : activeRatio < 0.4 ? "warning" : "neutral",
      key_findings: [...findings.risks, ...findings.opportunities].slice(0, 4),
      summary_cards: buildExecutiveCards(metrics, researchBundle),
      content_blocks: [
        makeBlock("paragraph", "Program Readout", strategy.executive_angle || "Affiliate growth should combine performance improvements with better category and creator alignment.", [], "", citations.slice(0, 2).map((item) => item.id)),
        makeBlock("bullet_list", "What the Data Says", "", [
          `Only ${(activeRatio * 100).toFixed(1)}% of publishers are active.`,
          `Top 10 publishers contribute ${(top10Share * 100).toFixed(1)}% of GMV.`,
          `${publishersTo50.toFixed(0)} publishers cover 50% of GMV.`,
        ]),
        makeBlock("callout", "Strategic Angle", strategy.category_relevance || category.summary || "Use category and competitor research to shape recruitment, creative briefs, and promo timing.", [], "", citations.slice(0, 2).map((item) => item.id)),
      ],
      tables: competitors.length ? [tableFromCompetitors(competitors.slice(0, 3))] : [],
      citations: citations.slice(0, 6),
      research_flags: sharedFlags,
    },
    1: {
      title: SECTION_BLUEPRINTS[1].title,
      conclusion: `Only ${(activeRatio * 100).toFixed(1)}% of partners are active.`,
      content_md: "Large parts of the partner base are not translating into revenue. Reactivation should be segmented by dormant top accounts, mid-tier potentials, and new recruits needing better enablement.",
      conclusion_status: activeRatio < 0.4 ? "warning" : "good",
      key_findings: findings.risks.filter((item) => item.linkPage === "Activation"),
      summary_cards: [
        makeCard("Active Ratio", `${(activeRatio * 100).toFixed(1)}%`, "This is the core activation KPI for the partner base.", activeRatio < 0.4 ? "warning" : "good"),
        makeCard("Orders", `${orders.toFixed(0)}`, "Existing order volume shows there is recoverable demand once more partners activate."),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Activation Priorities", "", uniqueStrings([
          "Split inactive publishers into recent revenue drop-offs versus never-activated accounts.",
          "Refresh creatives and landing-page angles for dormant partners before increasing incentives.",
          "Tie reactivation outreach to category moments, creator hooks, and promo windows.",
        ], 3)),
      ],
      tables: [],
      citations: [],
      research_flags: sharedFlags,
    },
    2: {
      title: SECTION_BLUEPRINTS[2].title,
      conclusion: `Top 10 partners drive ${(top10Share * 100).toFixed(1)}% of GMV.`,
      content_md: `The revenue base is concentrated, so program resilience depends on building a deeper mid-tier and recruiting partner types that reflect ${category.category_name || "category"} comparison and content journeys.`,
      conclusion_status: top10Share > 0.7 ? "bad" : "warning",
      key_findings: findings.risks.filter((item) => item.linkPage === "Concentration"),
      summary_cards: [
        makeCard("Top10 Share", `${(top10Share * 100).toFixed(1)}%`, "This is the primary concentration-risk KPI.", top10Share > 0.7 ? "bad" : "warning"),
        makeCard("Publishers to 50%", `${publishersTo50.toFixed(0)}`, "Fewer publishers needed to reach 50% means higher fragility.", publishersTo50 <= 3 ? "bad" : "neutral"),
      ],
      content_blocks: [
        makeBlock("callout", "Why It Matters", strategy.competitor_pressure || "If the current mix is too concentrated, competitor and category content opportunities are left under-covered.", [], "", citations.slice(0, 2).map((item) => item.id)),
      ],
      tables: competitors.length ? [tableFromCompetitors(competitors.slice(0, 4))] : [],
      citations: citations.slice(0, 4),
      research_flags: sharedFlags,
    },
    3: {
      title: SECTION_BLUEPRINTS[3].title,
      conclusion: capabilities.has_publisher_type
        ? "Publisher type data is available."
        : "Publisher type data is missing, so this section is partial.",
      content_md: capabilities.has_publisher_type
        ? `Use type mix to balance scale, comparison intent, creator storytelling, and promo capture for ${category.category_name || brandContext.brand_name || "the brand"}.`
        : `Publisher category coverage should reflect ${category.category_name || "the category"} journey, but the uploaded file did not include structured type data.`,
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: [
        makeCard("Type Coverage", capabilities.has_publisher_type ? "Available" : "Partial", "Mix Health needs reliable type data to benchmark structure.", capabilities.has_publisher_type ? "good" : "warning"),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Mix Implications", "", uniqueStrings([
          "Ensure creator/content partners cover proof and education.",
          "Keep comparison and deal partners active near high-intent moments.",
          "Use type-level recruitment to reduce concentration on one or two publisher models.",
        ], 3), "", citations.slice(0, 2).map((item) => item.id)),
      ],
      tables: [],
      citations: citations.slice(0, 4),
      research_flags: {
        ...sharedFlags,
        partial: !capabilities.has_publisher_type,
      },
    },
    4: {
      title: SECTION_BLUEPRINTS[4].title,
      conclusion: capabilities.has_commission
        ? `Tracked partner cost is $${commission.toFixed(2)}.`
        : "Cost data is partial, so efficiency analysis is limited.",
      content_md: capabilities.has_commission
        ? "Scale the partners already driving orders, but pair spend increases with clearer product hooks and landing-page alignment."
        : "Provide commission or payout data to unlock ROI-level efficiency analysis.",
      conclusion_status: "neutral",
      key_findings: findings.opportunities.filter((item) => item.linkPage === "Efficiency"),
      summary_cards: [
        makeCard("Orders", `${orders.toFixed(0)}`, "Existing order volume is the base for scale decisions."),
        makeCard("Tracked Cost", `$${commission.toFixed(2)}`, capabilities.has_commission ? "Use this with order volume to pressure-test unit economics." : "Cost coverage is partial.", capabilities.has_commission ? "neutral" : "warning"),
      ],
      content_blocks: [
        makeBlock("paragraph", "Efficiency Readout", "The most scalable efficiency plays combine order-driving partners with sharper proof, better landing-page match, and promo assets that convert demand without over-relying on discounting."),
      ],
      tables: [],
      citations: [],
      research_flags: {
        ...sharedFlags,
        partial: !capabilities.has_commission,
      },
    },
    5: {
      title: SECTION_BLUEPRINTS[5].title,
      conclusion: capabilities.has_approval_breakdown
        ? `Approval rate is ${(approvalRate * 100).toFixed(1)}%.`
        : "Approval breakdown is missing, so this section is partial.",
      content_md: capabilities.has_approval_breakdown
        ? "Use approved, pending, and declined revenue to separate true traffic quality from processing lag or policy friction."
        : "Provide approved, pending, and declined revenue to complete transaction-quality analysis.",
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: [
        makeCard("Approval Coverage", capabilities.has_approval_breakdown ? "Available" : "Partial", "Transaction-quality interpretation depends on approval breakdown.", capabilities.has_approval_breakdown ? "good" : "warning"),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Quality Lens", "", [
          "Compare high-GMV partners against approval quality before scaling investment.",
          "Separate fraud/policy issues from slower operational approval cycles.",
          "Use approval breakdown to govern offer mix and promo codes.",
        ]),
      ],
      tables: [],
      citations: [],
      research_flags: {
        ...sharedFlags,
        partial: !capabilities.has_approval_breakdown,
      },
    },
    6: {
      title: SECTION_BLUEPRINTS[6].title,
      conclusion: "The partner base should be split into top-tier, growth-tier, and activation-tier cohorts.",
      content_md: "Move from reactive account management to tier-based planning with differentiated briefs, incentives, and review cadences.",
      conclusion_status: "neutral",
      key_findings: findings.opportunities.slice(0, 1),
      summary_cards: [
        makeCard("Tiering Goal", "Top / Growth / Activation", "Different partner cohorts need different cadences and assets."),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Operating Principles", "", uniqueStrings([
          "Hero partners get exclusive planning, landing-page alignment, and quarterly business reviews.",
          "Growth-tier partners need category briefs, creator hooks, and seasonal incentives.",
          "Activation-tier partners need simpler creative packs and automated reactivation sequences.",
        ], 3)),
      ],
      tables: [],
      citations: [],
      research_flags: sharedFlags,
    },
    7: {
      title: SECTION_BLUEPRINTS[7].title,
      conclusion: `The strongest near-term actions are activation, de-concentration, and content alignment to ${brandContext.brand_name || "the brand"}.`,
      content_md: "Operate on a 30/60/90-day cadence: reactivate dormant partners, build the mid-tier, and package better creator-facing offers.",
      conclusion_status: "neutral",
      key_findings: [...findings.risks, ...findings.opportunities],
      summary_cards: [
        makeCard("30 Days", "Stabilize", uniqueStrings(strategy.action_30_days || [], 1)[0] || "Audit the current mix and refresh briefs."),
        makeCard("60 Days", "Expand", uniqueStrings(strategy.action_60_days || [], 1)[0] || "Recruit comparison and content partners."),
        makeCard("90 Days", "Institutionalize", uniqueStrings(strategy.action_90_days || [], 1)[0] || "Review results and formalize the operating rhythm."),
      ],
      content_blocks: [
        makeBlock("numbered_list", "30-Day Actions", "", strategy.action_30_days || []),
        makeBlock("numbered_list", "60-Day Actions", "", strategy.action_60_days || []),
        makeBlock("numbered_list", "90-Day Actions", "", strategy.action_90_days || []),
      ],
      tables: [],
      citations: citations.slice(0, 4),
      research_flags: sharedFlags,
    },
    8: {
      title: SECTION_BLUEPRINTS[8].title,
      conclusion: "Use a phased roadmap rather than one-off campaign changes.",
      content_md: "Activation, recruitment, landing-page refreshes, and governance should follow a staged operating rhythm rather than isolated pushes.",
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: [],
      content_blocks: [
        makeBlock("numbered_list", "Roadmap", "", [
          `Month 1: ${uniqueStrings(strategy.action_30_days || [], 1)[0] || "stabilize activation and clean up partner targeting"}`,
          `Month 2: ${uniqueStrings(strategy.action_60_days || [], 1)[0] || "recruit and enable new content and comparison partners"}`,
          `Month 3: ${uniqueStrings(strategy.action_90_days || [], 1)[0] || "measure mix shift, efficiency, and concentration change"}`,
        ]),
      ],
      tables: [],
      citations: citations.slice(0, 4),
      research_flags: sharedFlags,
    },
    9: {
      title: SECTION_BLUEPRINTS[9].title,
      conclusion: warnings[0] || "Dataset quality supports core analysis.",
      content_md: warnings.length ? warnings.join("\n") : "This dataset supports the core activation, concentration, efficiency, and research-backed strategy views.",
      conclusion_status: warnings.length > 0 ? "warning" : "good",
      key_findings: [],
      summary_cards: [
        makeCard("Warnings", `${warnings.length}`, warnings[0] || "No major dataset warnings.", warnings.length ? "warning" : "good"),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Limitations", "", warnings.length ? warnings : ["Core report inputs are available."]),
      ],
      tables: [],
      citations: [],
      research_flags: {
        ...sharedFlags,
        partial: warnings.length > 0,
      },
    },
    10: {
      title: SECTION_BLUEPRINTS[10].title,
      conclusion: "KPIs are computed from uploaded partner-level performance data and paired with live or cached market research.",
      content_md: "Performance numbers come only from the uploaded dataset. Market, category, competitor, and keyword interpretations come from brand-site evidence plus live or cached web research.",
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: [],
      content_blocks: [
        makeBlock("bullet_list", "Method", "", [
          "Parse and normalize the uploaded partner file.",
          "Compute deterministic KPIs and evidence tables from the dataset only.",
          "Build a market research bundle with brand, category, competitor, and keyword context.",
          "Generate report sections using both the deterministic data and the cited research bundle.",
        ]),
      ],
      tables: [],
      citations: citations.slice(0, 3),
      research_flags: sharedFlags,
    },
    11: {
      title: SECTION_BLUEPRINTS[11].title,
      conclusion: category.summary || `${brandContext.brand_name || "The brand"} operates in a category where creator proof and comparison intent matter.`,
      content_md: category.summary || "",
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: [
        makeCard("Category", category.category_name || "Unknown", strategy.category_relevance || category.summary || "", "neutral", citations.slice(0, 2).map((item) => item.id)),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Demand Signals", "", category.demand_signals || [], "", citations.slice(0, 2).map((item) => item.id)),
        makeBlock("bullet_list", "Merchandising Norms", "", category.merchandising_norms || [], "", citations.slice(0, 2).map((item) => item.id)),
        makeBlock("bullet_list", "Affiliate Fit", "", category.affiliate_fit || [], "", citations.slice(0, 2).map((item) => item.id)),
      ],
      tables: [
        makeTable(
          "Category Signals",
          ["Signal Type", "Evidence"],
          [
            ["Seasonality", uniqueStrings(category.seasonality || [], 3).join(", ")],
            ["Demand", uniqueStrings(category.demand_signals || [], 3).join(", ")],
            ["Affiliate Fit", uniqueStrings(category.affiliate_fit || [], 2).join(", ")],
          ],
          "Category observations are research-backed and directional.",
          citations.slice(0, 2).map((item) => item.id)
        ),
      ],
      citations: citations.slice(0, 6),
      research_flags: sharedFlags,
    },
    12: {
      title: SECTION_BLUEPRINTS[12].title,
      conclusion: competitors.length
        ? `${competitors.map((item) => item.name).join(", ")} are the clearest visible comparison points from the current research pass.`
        : "Competitive visibility is partial because live research evidence was limited.",
      content_md: strategy.competitor_pressure || "Use competitor positioning to inform partner recruitment, content briefs, and landing-page proof.",
      conclusion_status: competitors.length ? "neutral" : "warning",
      key_findings: [],
      summary_cards: competitors.slice(0, 4).map((item) => makeCard(item.name, item.domain, item.overlap_reason, item.confidence === "high" ? "good" : "warning", item.citation_ids || [])),
      content_blocks: competitors.map((item) =>
        makeBlock("competitor_card", item.name, item.positioning || "", [
          `Product focus: ${uniqueStrings(item.product_focus || [], 3).join(", ") || "n/a"}`,
          `Pricing cues: ${uniqueStrings(item.pricing_signals || [], 3).join(", ") || "n/a"}`,
          `Promotions: ${uniqueStrings(item.promo_signals || [], 3).join(", ") || "n/a"}`,
          `Affiliate takeaway: ${item.affiliate_takeaway || "n/a"}`,
        ], item.domain, item.citation_ids || [])
      ),
      tables: [tableFromCompetitors(competitors)],
      citations: citations.slice(0, 8),
      research_flags: {
        ...sharedFlags,
        partial: !competitors.length,
      },
    },
    13: {
      title: SECTION_BLUEPRINTS[13].title,
      conclusion: researchBundle?.keyword_landscape?.summary || "Keyword themes show where affiliates can support branded capture, comparison intent, and promo conversion.",
      content_md: researchBundle?.keyword_landscape?.summary || "",
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: keywordClusters.slice(0, 4).map((cluster) => makeCard(cluster.theme, cluster.cluster_type, cluster.intent, "neutral", cluster.citation_ids || [])),
      content_blocks: keywordClusters.map((cluster) =>
        makeBlock("keyword_cluster", cluster.theme, cluster.affiliate_angle || "", cluster.keywords || [], cluster.intent || "", cluster.citation_ids || [])
      ),
      tables: [tableFromKeywordClusters(keywordClusters)],
      citations: citations.slice(0, 8),
      research_flags: {
        ...sharedFlags,
        partial: !keywordClusters.length,
      },
    },
    14: {
      title: SECTION_BLUEPRINTS[14].title,
      conclusion: `${brandContext.brand_name || "The brand"} should align affiliate content to creator hooks, hero SKUs, and comparison-ready landing-page proof.`,
      content_md: strategy.category_relevance || brandContext.analysis_pack?.analysis_summary || "",
      conclusion_status: "neutral",
      key_findings: [],
      summary_cards: [
        makeCard("Brand Positioning", brandContext.brand_name || "Brand", brandContext.homepage_positioning || "", "neutral", citations.slice(0, 2).map((item) => item.id)),
        makeCard("Creative Hooks", `${uniqueStrings(strategy.creative_hooks || brandContext.creator_language || [], 6).length}`, "Themes that should show up in publisher briefs and landing pages.", "neutral", citations.slice(0, 2).map((item) => item.id)),
      ],
      content_blocks: [
        makeBlock("bullet_list", "Creative Hooks", "", uniqueStrings(strategy.creative_hooks || brandContext.creator_language || [], 6), "", citations.slice(0, 2).map((item) => item.id)),
        makeBlock("bullet_list", "Content Gaps", "", uniqueStrings(strategy.content_gaps || [], 6), "", citations.slice(0, 2).map((item) => item.id)),
        makeBlock("bullet_list", "Recruitment Priorities", "", uniqueStrings(strategy.recruitment_priorities || [], 6), "", citations.slice(0, 2).map((item) => item.id)),
      ],
      tables: [],
      citations: citations.slice(0, 6),
      research_flags: sharedFlags,
    },
    15: {
      title: SECTION_BLUEPRINTS[15].title,
      conclusion: citations.length ? `${citations.length} research sources supported this report.` : "Research source capture was limited for this run.",
      content_md: (researchBundle?.confidence_notes || []).join(" ") || "Use the following citations to trace category, competitor, and keyword claims.",
      conclusion_status: citations.length ? "neutral" : "warning",
      key_findings: [],
      summary_cards: [
        makeCard("Sources", `${citations.length}`, "Market and competitor claims should be read alongside these citations.", citations.length ? "good" : "warning"),
      ],
      content_blocks: [
        makeBlock("source_list", "Confidence Notes", "", researchBundle?.confidence_notes || [], "", citations.slice(0, 3).map((item) => item.id)),
      ],
      tables: [buildResearchSourceTable(citations)],
      citations,
      research_flags: {
        ...sharedFlags,
        partial: !citations.length,
      },
    },
  };

  return sections[sectionId];
}

async function generateSectionWithAi({ sectionId, dataset, metrics, evidenceTables, researchBundle, warnings, findings, language = "en" }) {
  const unsupported =
    (sectionId === 3 && !dataset.capabilities?.has_publisher_type) ||
    (sectionId === 4 && !dataset.capabilities?.has_commission) ||
    (sectionId === 5 && !dataset.capabilities?.has_approval_breakdown);

  if (unsupported) {
    return { ...fallbackSection(sectionId, dataset, metrics, warnings, researchBundle), ai_generated: false };
  }

  try {
    const result = await openAiJson({
      system:
        "You are a senior affiliate growth strategist. Produce deep but grounded report chapters for a boardroom-ready affiliate report. Use the structured fields to make the report skimmable and actionable.",
      prompt: buildSectionPrompt({ sectionId, dataset, metrics, evidenceTables, researchBundle, warnings, findings, language }),
      schemaName: `report_section_${sectionId}`,
      schema: sectionSchema(),
      temperature: 0.2,
    });
    return { ...result, ai_generated: true };
  } catch {
    return { ...fallbackSection(sectionId, dataset, metrics, warnings, researchBundle), ai_generated: false };
  }
}

export async function generateSections({ dataset, metrics, evidenceTables, warnings, sectionIds = DEFAULT_SECTION_IDS, language = "en" }) {
  const researchBundle = dataset.website_scrape_data || {};
  const findings = summarizeFindings(metrics, brandContextFromBundle(researchBundle));

  const generated = await Promise.all(
    sectionIds.map(async (sectionId) => {
      const section = await generateSectionWithAi({
        sectionId,
        dataset,
        metrics,
        evidenceTables,
        researchBundle,
        warnings,
        findings,
        language,
      });
      return {
        id: uid("reportsection"),
        dataset_id: dataset.id,
        section_id: sectionId,
        title: section.title,
        content_md: section.content_md,
        conclusion: section.conclusion,
        conclusion_status: section.conclusion_status,
        key_findings: section.key_findings || [],
        summary_cards: section.summary_cards || [],
        content_blocks: section.content_blocks || [],
        tables: section.tables || [],
        citations: section.citations || [],
        research_flags: section.research_flags || {
          partial: false,
          uses_live_research: false,
          cache_hit: false,
          confidence: "medium",
        },
        derivation_notes: warnings,
        ai_generated: section.ai_generated !== false,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
    })
  );

  return { sections: generated, generated_sections: generated.map((item) => item.section_id), skipped_sections: [] };
}

export function createActionItemsFromFindings(sections = []) {
  const seen = new Set();
  const findings = sections
    .flatMap((section) => section.key_findings || [])
    .filter((item) => item.type === "risk" || item.type === "opportunity")
    .filter((item) => {
      const key = `${item.type}:${String(item.title || "").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  return findings.map((finding, index) => ({
    id: uid("actionitem"),
    title: finding.action || finding.title,
    workstream:
      finding.linkPage === "Activation"
        ? "content_expansion"
        : finding.linkPage === "Concentration"
          ? "tier_management"
          : finding.linkPage === "Efficiency"
            ? "deal_optimization"
            : "other",
    priority: finding.type === "risk" ? "high" : "medium",
    status: "todo",
    owner: finding.owner || "Growth",
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * (finding.type === "risk" ? 30 : 45)).toISOString().split("T")[0],
    kpi_target: index === 0 ? "Active publisher rate > 40%" : "Partner channel performance improves",
    notes: finding.trigger || "",
    evidence_link: finding.linkPage || "",
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  }));
}

export async function generateActionItemsWithAi({ findingsSummary, language = "en" }) {
  const today = new Date().toISOString().split("T")[0];
  const result = await openAiJson({
    system:
      "You are an affiliate program manager. Turn analysis findings into practical actions. Return JSON only.",
    prompt: `Today's date is ${today}. Based on these affiliate findings, generate action items in ${language === "zh" ? "Chinese" : "English"}.

${JSON.stringify(findingsSummary, null, 2)}`,
    schemaName: "action_items",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              finding_index: { type: "number" },
              title: { type: "string" },
              workstream: { type: "string" },
              priority: { type: "string" },
              owner: { type: "string" },
              due_date: { type: "string" },
              kpi_target: { type: "string" },
              tags: { type: "string" },
              notes: { type: "string" },
            },
            required: ["finding_index", "title", "workstream", "priority", "owner", "due_date", "kpi_target", "tags", "notes"],
          },
        },
      },
      required: ["items"],
    },
    temperature: 0.2,
  });

  return result.items || [];
}

export async function runDatasetWorkflow(db, payload, persist = async () => {}) {
  const { dataset_id, field_mapping = {}, cleaning_options = {} } = payload;
  const datasetIndex = db.DataUpload.findIndex((item) => item.id === dataset_id);
  if (datasetIndex === -1) throw new Error(`Dataset ${dataset_id} not found`);
  const stageTimings = {};
  const stageStartedAt = {};
  const startStage = (name) => {
    stageStartedAt[name] = Date.now();
  };
  const finishStage = (name) => {
    stageTimings[name] = Date.now() - (stageStartedAt[name] || Date.now());
  };

  db.DataUpload[datasetIndex] = upsertDatasetRecord(db.DataUpload[datasetIndex], {
    status: "processing",
    processing_progress: 5,
    processing_step: "Parsing uploaded file",
    processing_started_at: new Date().toISOString(),
    sections_ready: [],
    processing_completed_at: null,
  });
  db.Job = db.Job.filter((item) => item.dataset_id !== dataset_id);
  db.Job.push({
    id: uid("job"),
    dataset_id,
    status: "processing",
    stage: "parse",
    progress: 5,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  });
  const jobIndex = db.Job.length - 1;
  await persist();

  const dataset = db.DataUpload[datasetIndex];
  startStage("parse");
  const parseResult = parseDatasetRows({
    datasetId: dataset.id,
    rows: dataset.source_rows || [],
    headers: dataset.source_headers || [],
    fieldMapping: field_mapping,
    cleaningOptions: cleaning_options,
  });
  finishStage("parse");

  db.Publisher = db.Publisher.filter((item) => item.dataset_id !== dataset.id);
  db.MetricSnapshot = db.MetricSnapshot.filter((item) => item.dataset_id !== dataset.id);
  db.EvidenceTable = db.EvidenceTable.filter((item) => item.dataset_id !== dataset.id);
  db.ReportSection = db.ReportSection.filter((item) => item.dataset_id !== dataset.id);

  db.Publisher.push(
    ...parseResult.publishers.map((publisher) => ({
      id: uid("publisher"),
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      ...publisher,
    }))
  );

  let capabilities = createCapabilities(parseResult.field_mapping, false);
  let warnings = buildDatasetWarnings(capabilities, parseResult.field_mapping);
  const normalizedWebsiteUrl = normalizeWebsiteUrl(dataset.website_url);

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    row_count: parseResult.row_count,
    field_mapping: parseResult.field_mapping,
    capabilities,
    processing_warnings: warnings,
    processing_progress: 28,
    processing_step: "Preparing dataset",
  };
  db.Job[jobIndex] = {
    ...db.Job[jobIndex],
    stage: "dataset_ready",
    progress: 28,
    updated_date: new Date().toISOString(),
  };
  await persist();

  if (!capabilities.has_publisher_type) {
    startStage("publisher_type_enrichment");
    db.DataUpload[datasetIndex] = {
      ...db.DataUpload[datasetIndex],
      website_url: normalizedWebsiteUrl,
      processing_progress: 42,
      processing_step: "Researching publisher types online",
    };
    db.Job[jobIndex] = {
      ...db.Job[jobIndex],
      stage: "publisher_type_enrichment",
      progress: 42,
      updated_date: new Date().toISOString(),
    };
    await persist();

    const datasetPublishers = db.Publisher.filter((item) => item.dataset_id === dataset.id);
    const enrichmentResult = await enrichPublisherTypes({ db, publishers: datasetPublishers });
    capabilities.has_publisher_type = enrichmentResult.hasPublisherTypeData;
    warnings = buildDatasetWarnings(capabilities, parseResult.field_mapping);
    if (enrichmentResult.hasPublisherTypeData) {
      warnings.push(`Publisher type was enriched via online research for ${enrichmentResult.enrichedCount} publishers.`);
    }
    finishStage("publisher_type_enrichment");
  }

  startStage("compute");
  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    website_url: normalizedWebsiteUrl,
    capabilities,
    processing_warnings: warnings,
    processing_progress: 55,
    processing_step: "Computing metrics",
  };
  db.Job[jobIndex] = {
    ...db.Job[jobIndex],
    stage: "metrics",
    progress: 55,
    updated_date: new Date().toISOString(),
  };
  await persist();

  const computeResult = computeDatasetArtifacts({
    publishers: db.Publisher.filter((item) => item.dataset_id === dataset.id),
    capabilities,
    datasetWarnings: warnings,
  });
  finishStage("compute");

  db.MetricSnapshot.push(
    ...computeResult.metrics.map((item) => ({
      id: uid("metricsnapshot"),
      dataset_id: dataset.id,
      calc_version: new Date().toISOString(),
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      ...item,
    }))
  );
  db.EvidenceTable.push(
    ...computeResult.evidenceTables.map((item) => ({
      id: uid("evidencetable"),
      dataset_id: dataset.id,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      ...item,
    }))
  );

  const domain = normalizedWebsiteUrl ? new URL(normalizedWebsiteUrl).hostname.replace(/^www\./, "") : "";
  const cachedResearch = domain ? (db.BrandResearchCache || []).find((item) => item.domain === domain) : null;
  let researchBundle = null;
  let researchWarnings = [];
  let researchCacheHit = false;
  let researchSource = "fallback";
  let searchQueries = [];
  let searchResultCount = 0;

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    processing_progress: 72,
    processing_step: normalizedWebsiteUrl ? "Researching market & competitor context" : "Skipping brand research (no website URL)",
    processing_warnings: computeResult.warnings,
  };
  db.Job[jobIndex] = {
    ...db.Job[jobIndex],
    stage: "research_bundle",
    progress: 72,
    updated_date: new Date().toISOString(),
  };
  await persist();

  if (!normalizedWebsiteUrl) {
    researchWarnings.push("No website URL provided — brand and market research skipped.");
  } else if (cachedResearch && isResearchCacheFresh(cachedResearch) && hasRichResearchPayload(cachedResearch.payload)) {
    researchBundle = normalizeResearchBundle({
      websiteUrl: normalizedWebsiteUrl,
      brandContext: brandContextFromBundle(cachedResearch.payload),
      researchMode: cachedResearch.payload.research_mode || "balanced_live",
      cacheHit: true,
      research: cachedResearch.payload,
      searchPayload: [],
    });
    researchCacheHit = true;
    researchSource = cachedResearch.payload.research_mode || "cache";
    stageTimings.brand_research = 0;
    stageTimings.market_research = 0;
  } else {
    startStage("brand_research");
    const brandContext = await researchBrand(normalizedWebsiteUrl);
    finishStage("brand_research");

    startStage("market_research");
    const researchResult = await buildResearchBundle({
      websiteUrl: normalizedWebsiteUrl,
      brandContext,
      researchMode: "balanced_live",
    });
    finishStage("market_research");
    researchBundle = researchResult.bundle;
    researchWarnings = researchResult.warnings || [];
    researchSource = researchResult.source || "fallback";
    searchQueries = researchResult.search_queries || [];
    searchResultCount = researchResult.search_result_count || 0;

    if (cachedResearch) {
      Object.assign(cachedResearch, {
        payload: researchBundle,
        updated_date: new Date().toISOString(),
      });
    } else if (domain) {
      db.BrandResearchCache.push({
        id: uid("brandcache"),
        domain,
        payload: researchBundle,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });
    }
  }

  capabilities = {
    ...capabilities,
    has_brand_context: !!researchBundle,
  };
  warnings = Array.from(new Set([...(computeResult.warnings || []), ...(researchWarnings || [])]));

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    website_url: normalizedWebsiteUrl || dataset.website_url || "",
    website_scrape_data: researchBundle,
    capabilities,
    processing_progress: 72,
    processing_step: "Research bundle ready",
    processing_warnings: warnings,
  };
  db.Job[jobIndex] = {
    ...db.Job[jobIndex],
    stage: "research_ready",
    progress: 72,
    updated_date: new Date().toISOString(),
  };
  await persist();

  startStage("ai_sections");
  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    processing_progress: 84,
    processing_step: "Generating AI sections",
    processing_warnings: warnings,
  };
  db.Job[jobIndex] = {
    ...db.Job[jobIndex],
    stage: "ai_sections",
    progress: 84,
    updated_date: new Date().toISOString(),
  };
  await persist();

  const refreshedDataset = db.DataUpload[datasetIndex];
  const sectionResult = await generateSections({
    dataset: refreshedDataset,
    metrics: db.MetricSnapshot.filter((item) => item.dataset_id === dataset.id),
    evidenceTables: db.EvidenceTable.filter((item) => item.dataset_id === dataset.id),
    warnings,
  });
  finishStage("ai_sections");

  db.ReportSection.push(...sectionResult.sections);
  db.ActionItem = db.ActionItem.filter((item) => item.dataset_id !== dataset.id);
  db.ActionItem.push(
    ...createActionItemsFromFindings(sectionResult.sections).map((item) => ({
      ...item,
      dataset_id: dataset.id,
    }))
  );
  stageTimings.action_items = 0;

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    status: "completed",
    processing_progress: 100,
    processing_step: "Completed",
    processing_completed_at: new Date().toISOString(),
    sections_ready: sectionResult.generated_sections,
    processing_warnings: warnings,
  };
  db.Job[jobIndex] = {
    ...db.Job[jobIndex],
    status: "completed",
    stage: "done",
    progress: 100,
    updated_date: new Date().toISOString(),
  };
  await persist();

  return {
    success: true,
    warnings,
    steps: {
      parse: {
        success: true,
        row_count: parseResult.row_count,
        publisher_count: parseResult.publisher_count,
        field_mapping: parseResult.field_mapping,
        capabilities,
        warnings: parseResult.warnings,
        duration_ms: stageTimings.parse || 0,
      },
      publisher_type_enrichment: {
        success: true,
        enriched: capabilities.has_publisher_type,
        duration_ms: stageTimings.publisher_type_enrichment || 0,
      },
      compute: {
        success: true,
        metrics_summary: computeResult.summary,
        warnings: computeResult.warnings,
        duration_ms: stageTimings.compute || 0,
      },
      research_bundle: {
        success: true,
        cache_hit: researchCacheHit,
        source: researchSource,
        discovered_competitors: (researchBundle?.competitors || []).map((item) => item.name),
        keyword_cluster_count: researchBundle?.keyword_landscape?.clusters?.length || 0,
        search_query_count: searchQueries.length,
        search_result_count: searchResultCount,
        warnings: researchWarnings,
        duration_ms: (stageTimings.brand_research || 0) + (stageTimings.market_research || 0),
      },
      ai_generate: {
        success: true,
        generated_sections: sectionResult.generated_sections,
        duration_ms: stageTimings.ai_sections || 0,
      },
      action_items: {
        success: true,
        item_count: db.ActionItem.filter((item) => item.dataset_id === dataset.id).length,
      },
    },
  };
}

export async function generateReportPayload({ dataset, sections, metrics, format = "pdf" }) {
  if (format === "markdown") {
    return { data: markdownFromSections(dataset, sections, metrics) };
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const accent = { r: 31, g: 111, b: 235 };
  const slate = { r: 51, g: 65, b: 85 };
  const muted = { r: 100, g: 116, b: 139 };
  const border = { r: 226, g: 232, b: 240 };
  const soft = { r: 248, g: 250, b: 252 };
  let y = 18;

  const sortedSections = [...sections].sort((a, b) => a.section_id - b.section_id);
  const warnings = dataset.processing_warnings || [];
  const coreKpis = [
    { label: "Active Ratio", value: `${(getMetricValue(metrics, "active_ratio") * 100).toFixed(1)}%` },
    { label: "Total GMV", value: `$${getMetricValue(metrics, "total_gmv").toFixed(2)}` },
    { label: "Top10 Share", value: `${(getMetricValue(metrics, "top10_share") * 100).toFixed(1)}%` },
    { label: "Orders", value: `${getMetricValue(metrics, "total_orders").toFixed(0)}` },
    { label: "Commission", value: `$${getMetricValue(metrics, "total_commission").toFixed(2)}` },
    { label: "Dataset Rows", value: `${dataset.row_count || 0}` },
  ];

  function addPage() {
    doc.addPage();
    y = 18;
  }

  function ensureSpace(heightNeeded) {
    if (y + heightNeeded > pageHeight - 18) addPage();
  }

  function setColor({ r, g, b }) {
    doc.setTextColor(r, g, b);
  }

  function drawRule(offset = 0) {
    doc.setDrawColor(border.r, border.g, border.b);
    doc.line(margin, y + offset, pageWidth - margin, y + offset);
  }

  function drawParagraph(text, options = {}) {
    const {
      fontSize = 11,
      color = slate,
      lineHeight = 5.4,
      indent = 0,
      topGap = 0,
      bottomGap = 0,
      maxWidth = contentWidth - indent,
      font = "helvetica",
      style = "normal",
    } = options;
    const cleanText = String(text || "")
      .replace(/^#+\s*/gm, "")
      .replace(/^\-\s+/gm, "")
      .trim();
    if (!cleanText) return;
    doc.setFont(font, style);
    doc.setFontSize(fontSize);
    setColor(color);
    const lines = doc.splitTextToSize(cleanText, maxWidth);
    ensureSpace(topGap + lines.length * lineHeight + bottomGap);
    y += topGap;
    doc.text(lines, margin + indent, y);
    y += lines.length * lineHeight + bottomGap;
  }

  function drawLabelValue(label, value, x, top, width) {
    doc.setFillColor(soft.r, soft.g, soft.b);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.roundedRect(x, top, width, 18, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setColor(muted);
    doc.text(label.toUpperCase(), x + 3, top + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setColor(slate);
    doc.text(value, x + 3, top + 12.5);
  }

  function drawSectionCards(cards = []) {
    if (!cards.length) return;
    const columns = 2;
    const cardWidth = (contentWidth - 4) / columns;

    cards.forEach((card, index) => {
      const col = index % columns;
      if (col === 0) {
        ensureSpace(28);
      }
      const rowY = y + Math.floor(index / columns) * 30;
      const x = margin + col * (cardWidth + 4);
      const tone =
        card.tone === "good"
          ? { fill: [236, 253, 245], stroke: [167, 243, 208] }
          : card.tone === "warning"
            ? { fill: [255, 251, 235], stroke: [253, 230, 138] }
            : card.tone === "bad"
              ? { fill: [254, 242, 242], stroke: [254, 202, 202] }
              : { fill: [248, 250, 252], stroke: [226, 232, 240] };
      doc.setFillColor(...tone.fill);
      doc.setDrawColor(...tone.stroke);
      doc.roundedRect(x, rowY, cardWidth, 24, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(muted);
      doc.text(String(card.label || "").toUpperCase(), x + 3, rowY + 5);
      doc.setFontSize(11.5);
      setColor(slate);
      doc.text(doc.splitTextToSize(card.value || "", cardWidth - 6), x + 3, rowY + 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(muted);
      const insightLines = doc.splitTextToSize(card.insight || "", cardWidth - 6).slice(0, 2);
      if (insightLines.length) {
        doc.text(insightLines, x + 3, rowY + 17);
      }
    });

    y += Math.ceil(cards.length / columns) * 30;
  }

  function drawStructuredBlock(block) {
    if (!block) return;
    const lines = [];
    if (block.title) lines.push(block.title);
    if (block.body) lines.push(block.body);
    (block.items || []).forEach((item, index) => {
      lines.push(`${block.type === "numbered_list" ? `${index + 1}.` : "-"} ${item}`);
    });
    if (block.meta) lines.push(`Note: ${block.meta}`);
    if (!lines.length) return;

    const wrapped = lines.flatMap((line, index) =>
      doc.splitTextToSize(line, contentWidth - 10).map((segment, segmentIndex) => ({
        text: segment,
        bold: index === 0 && !!block.title && segmentIndex === 0,
      }))
    );
    const height = 10 + wrapped.length * 5 + 4;
    ensureSpace(height + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.roundedRect(margin, y, contentWidth, height, 3, 3, "FD");
    let innerY = y + 6;
    wrapped.forEach((line) => {
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      doc.setFontSize(line.bold ? 10.5 : 9.5);
      setColor(line.bold ? slate : muted);
      doc.text(line.text, margin + 4, innerY);
      innerY += 5;
    });
    y += height + 4;
  }

  function drawStructuredTable(table) {
    if (!table?.columns?.length) return;
    const columns = table.columns.length;
    const columnWidth = contentWidth / Math.max(columns, 1);
    drawParagraph(table.title || "Table", { fontSize: 10.5, style: "bold", color: slate, bottomGap: 2 });
    if (table.note) {
      drawParagraph(table.note, { fontSize: 8.8, color: muted, bottomGap: 2 });
    }
    const rows = [table.columns, ...(table.rows || [])];
    const rowHeight = 7;
    rows.forEach((row, rowIndex) => {
      ensureSpace(rowHeight + 1);
      row.forEach((cell, cellIndex) => {
        const x = margin + columnWidth * cellIndex;
        doc.setFillColor(rowIndex === 0 ? accent.r : 255, rowIndex === 0 ? accent.g : 255, rowIndex === 0 ? accent.b : 255);
        doc.setDrawColor(border.r, border.g, border.b);
        doc.rect(x, y, columnWidth, rowHeight, rowIndex === 0 ? "FD" : "S");
        doc.setFont("helvetica", rowIndex === 0 ? "bold" : "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(rowIndex === 0 ? 255 : slate.r, rowIndex === 0 ? 255 : slate.g, rowIndex === 0 ? 255 : slate.b);
        const text = doc.splitTextToSize(String(cell || ""), columnWidth - 2).slice(0, 2);
        doc.text(text, x + 1.5, y + 4.2);
      });
      y += rowHeight;
    });
    y += 3;
  }

  function drawSourceList(citations = []) {
    if (!citations.length) return;
    drawParagraph("Sources", { fontSize: 10.5, style: "bold", color: slate, bottomGap: 1 });
    citations.forEach((citation) => {
      drawParagraph(`[${citation.id}] ${citation.title} — ${citation.url}${citation.note ? ` (${citation.note})` : ""}`, {
        fontSize: 8.8,
        color: muted,
        lineHeight: 4.6,
        bottomGap: 1,
      });
    });
  }

  function drawFindingCard(finding, index) {
    const normalized = typeof finding === "string" ? { title: finding, type: "note" } : (finding || {});
    const tones = normalized.type === "risk"
      ? { fill: [254, 242, 242], stroke: [254, 202, 202], badge: [185, 28, 28], label: "RISK" }
      : normalized.type === "opportunity"
        ? { fill: [239, 246, 255], stroke: [191, 219, 254], badge: [29, 78, 216], label: "OPPORTUNITY" }
        : { fill: [248, 250, 252], stroke: [226, 232, 240], badge: [71, 85, 105], label: "NOTE" };
    const bodyLines = [];
    bodyLines.push(`${index + 1}. ${normalized.title || "Finding"}`);
    if (normalized.trigger) bodyLines.push(`Trigger: ${normalized.trigger}`);
    if (normalized.action) bodyLines.push(`Action: ${normalized.action}`);
    const meta = [normalized.owner ? `Owner: ${normalized.owner}` : "", normalized.deadline ? `Due: ${normalized.deadline}` : "", normalized.linkPage ? `Page: ${normalized.linkPage}` : ""]
      .filter(Boolean)
      .join("  |  ");
    if (meta) bodyLines.push(meta);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const wrapped = bodyLines.flatMap((line, i) =>
      doc.splitTextToSize(line, contentWidth - 12).map((segment, j) => ({ text: segment, bold: i === 0 && j === 0 }))
    );
    const cardHeight = 10 + wrapped.length * 5.2 + 8;
    ensureSpace(cardHeight + 3);
    doc.setFillColor(...tones.fill);
    doc.setDrawColor(...tones.stroke);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, "FD");
    doc.setFillColor(...tones.stroke);
    doc.roundedRect(margin + 4, y + 4, 24, 6, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor({ r: tones.badge[0], g: tones.badge[1], b: tones.badge[2] });
    doc.text(tones.label, margin + 7, y + 8.4);
    let innerY = y + 15;
    wrapped.forEach((line) => {
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      doc.setFontSize(line.bold ? 11 : 9.6);
      setColor(line.bold ? slate : muted);
      doc.text(line.text, margin + 6, innerY);
      innerY += 5.2;
    });
    y += cardHeight + 4;
  }

  function drawSection(section) {
    ensureSpace(24);
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.roundedRect(margin, y, contentWidth, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(219, 234, 254);
    doc.text(`CHAPTER ${section.section_id}`, margin + 4, y + 5.2);
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(section.title || `Section ${section.section_id}`, margin + 4, y + 11);
    y += 18;

    if (section.conclusion) {
      doc.setFillColor(soft.r, soft.g, soft.b);
      doc.setDrawColor(border.r, border.g, border.b);
      const lines = doc.splitTextToSize(section.conclusion, contentWidth - 10);
      const boxHeight = 10 + lines.length * 5.2;
      ensureSpace(boxHeight + 4);
      doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setColor(accent);
      doc.text("CONCLUSION", margin + 4, y + 5.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      setColor(slate);
      doc.text(lines, margin + 4, y + 10.8);
      y += boxHeight + 5;
    }

    if (section.summary_cards?.length && section.section_id !== 0) {
      drawSectionCards(section.summary_cards);
    }

    if (section.content_md) {
      drawParagraph(section.content_md, { fontSize: 10.5, color: slate, lineHeight: 5.2, bottomGap: 3 });
    }

    if (section.content_blocks?.length) {
      section.content_blocks.forEach((block) => drawStructuredBlock(block));
    }

    if (section.tables?.length) {
      section.tables.forEach((table) => drawStructuredTable(table));
    }

    if (section.key_findings?.length) {
      drawParagraph("Key Findings", { fontSize: 11, style: "bold", color: slate, topGap: 1, bottomGap: 2 });
      section.key_findings.forEach((finding, index) => drawFindingCard(finding, index));
    }

    if (section.citations?.length) {
      drawSourceList(section.citations);
    }

    y += 2;
  }

  doc.setFillColor(247, 250, 252);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 44, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Affiliate Growth Intelligence", margin, 18);
  doc.setFontSize(10);
  doc.setTextColor(219, 234, 254);
  doc.text("Performance report and action plan", margin, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Dataset: ${dataset.version_label || dataset.file_name || "Latest"}`, margin, 34);
  doc.text(`Brand: ${dataset.website_scrape_data?.brand_name || dataset.website_url || "N/A"}`, margin, 40);
  y = 54;

  drawParagraph(`Generated ${new Date().toLocaleString()}`, { fontSize: 9.5, color: muted, bottomGap: 4 });

  ensureSpace(28);
  drawParagraph("Core KPIs", { fontSize: 12.5, style: "bold", color: slate, bottomGap: 2 });
  const cardWidth = (contentWidth - 8) / 3;
  let cardTop = y;
  coreKpis.forEach((item, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    drawLabelValue(item.label, item.value, margin + col * (cardWidth + 4), cardTop + row * 22, cardWidth);
  });
  y += 46;

  if (warnings.length) {
    ensureSpace(16);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    const warningLines = warnings.flatMap((warning) => doc.splitTextToSize(`- ${warning}`, contentWidth - 10));
    const warningHeight = 9 + warningLines.length * 4.8;
    doc.roundedRect(margin, y, contentWidth, warningHeight, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(146, 64, 14);
    doc.text("Dataset Warnings", margin + 4, y + 5.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.6);
    doc.text(warningLines, margin + 4, y + 10.5);
    y += warningHeight + 6;
  }

  if (dataset.website_scrape_data?.analysis_pack?.analysis_summary) {
    drawParagraph("Brand Context", { fontSize: 12, style: "bold", color: slate, bottomGap: 2 });
    drawParagraph(dataset.website_scrape_data.analysis_pack.analysis_summary, { fontSize: 10, color: muted, bottomGap: 5 });
  }

  const executiveSection = sortedSections.find((section) => section.section_id === 0);
  if (executiveSection?.summary_cards?.length) {
    drawParagraph("Board Signals", { fontSize: 12, style: "bold", color: slate, bottomGap: 2 });
    drawSectionCards(executiveSection.summary_cards);
    y += 2;
  }

  sortedSections.forEach((section) => drawSection(section));

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(border.r, border.g, border.b);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(dataset.version_label || dataset.file_name || "Dataset", margin, pageHeight - 5);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin - 18, pageHeight - 5);
  }

  return {
    data: {
      success: true,
      format: "pdf",
      filename: `Affiliate-Report-${dataset.version_label || "latest"}.pdf`,
      pdf_base64: doc.output("datauristring").split(",")[1],
    },
  };
}

export function applyNormalizedMapping(headers = [], mapping = {}) {
  return Object.keys(mapping || {}).length > 0 ? mapping : normalizeFieldMapping(headers);
}
