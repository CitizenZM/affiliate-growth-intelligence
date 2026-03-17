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
import { openAiJson } from "./openai.js";
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
    ["360 Cameras", /360|x5|x4|camera/],
    ["Action Cameras", /action|ace/],
    ["Webcams", /webcam|link/],
    ["Gimbals", /gimbal|flow/],
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

function buildSectionPrompt({ sectionId, dataset, metrics, evidenceTables, brandContext, warnings, findings }) {
  return `Create section ${sectionId} for an affiliate growth dashboard.

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

Brand Context:
${JSON.stringify(brandContext, null, 2)}

Rule-based findings:
${JSON.stringify(findings, null, 2)}

Write concise, evidence-backed business analysis. Use only numbers from the dataset. If data is partial, say so clearly.`;
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
    },
    required: ["title", "conclusion", "content_md", "conclusion_status", "key_findings"],
  };
}

function fallbackSection(sectionId, dataset, metrics, warnings, brandContext) {
  const capabilities = dataset.capabilities || {};
  const findings = summarizeFindings(metrics, brandContext);
  const totalGMV = getMetricValue(metrics, "total_gmv");
  const activeRatio = getMetricValue(metrics, "active_ratio");
  const top10Share = getMetricValue(metrics, "top10_share");
  const sections = {
    0: {
      title: "Executive Summary - KPI Cockpit",
      conclusion: `GMV is $${totalGMV.toFixed(2)}, active ratio is ${(activeRatio * 100).toFixed(1)}%, and top-10 share is ${(top10Share * 100).toFixed(1)}%.`,
      content_md: `The current program shows low activation and high concentration. Priorities are partner reactivation, mid-tier growth, and closer alignment to ${brandContext.brand_name || "brand"} merchandising.`,
      conclusion_status: top10Share > 0.7 ? "bad" : "warning",
      key_findings: [...findings.risks, ...findings.opportunities].slice(0, 4),
    },
    1: {
      title: "Activation Funnel",
      conclusion: `Only ${(activeRatio * 100).toFixed(1)}% of partners are active.`,
      content_md: "Large portions of the partner base are not converting. Focus on onboarding, creative refreshes, and segmented outreach.",
      conclusion_status: activeRatio < 0.4 ? "warning" : "good",
      key_findings: findings.risks.filter((item) => item.linkPage === "Activation"),
    },
    2: {
      title: "Revenue Concentration Analysis",
      conclusion: `Top 10 partners drive ${(top10Share * 100).toFixed(1)}% of GMV.`,
      content_md: "The revenue base is fragile. Expand the mid-tier and recruit more creator-led publishers to reduce dependency on a few top accounts.",
      conclusion_status: top10Share > 0.7 ? "bad" : "warning",
      key_findings: findings.risks.filter((item) => item.linkPage === "Concentration"),
    },
    3: {
      title: "Mix Health - Publisher Type Distribution",
      conclusion: capabilities.has_publisher_type
        ? "Publisher type data is available."
        : "Publisher type data is missing, so this section is partial.",
      content_md: capabilities.has_publisher_type
        ? "Use type mix to balance scale, efficiency, and content coverage."
        : "Upload a source with publisher type/category to complete structural mix analysis.",
      conclusion_status: "neutral",
      key_findings: [],
    },
    4: {
      title: "Efficiency Quadrant",
      conclusion: capabilities.has_commission
        ? `Tracked partner cost is $${getMetricValue(metrics, "total_commission").toFixed(2)}.`
        : "Cost data is partial, so efficiency analysis is limited.",
      content_md: capabilities.has_commission
        ? "Scale the partners delivering orders while pressure-testing cost efficiency on top contributors."
        : "Provide commission or payout data to unlock ROI-level efficiency analysis.",
      conclusion_status: "neutral",
      key_findings: findings.opportunities.filter((item) => item.linkPage === "Efficiency"),
    },
    5: {
      title: "Approval & Transaction Quality",
      conclusion: capabilities.has_approval_breakdown
        ? `Approval rate is ${(getMetricValue(metrics, "approval_rate") * 100).toFixed(1)}%.`
        : "Approval breakdown is missing, so this section is partial.",
      content_md: capabilities.has_approval_breakdown
        ? "Use approved, pending, and declined revenue to separate traffic quality from processing lag."
        : "Provide approved/pending/declined revenue to complete transaction quality analysis.",
      conclusion_status: "neutral",
      key_findings: [],
    },
    6: {
      title: "Tier Management",
      conclusion: "The partner base should be split into top-tier, growth-tier, and activation-tier cohorts.",
      content_md: "Move from reactive account management to tier-based planning with differentiated briefs, incentives, and review cadences.",
      conclusion_status: "neutral",
      key_findings: findings.opportunities.slice(0, 1),
    },
    7: {
      title: "Action Plan Recommendations",
      conclusion: `The strongest near-term actions are activation, de-concentration, and content alignment to ${brandContext.brand_name || "the brand"}.`,
      content_md: "Operate on a 30/60/90-day cadence: reactivate dormant partners, build the mid-tier, and package better creator-facing offers.",
      conclusion_status: "neutral",
      key_findings: [...findings.risks, ...findings.opportunities],
    },
    8: {
      title: "Timeline & Roadmap",
      conclusion: "Use a phased roadmap rather than one-off campaign changes.",
      content_md: "Month 1: activation. Month 2: partner recruitment and enablement. Month 3: efficiency optimization and governance.",
      conclusion_status: "neutral",
      key_findings: [],
    },
    9: {
      title: "Data Quality Assessment",
      conclusion: warnings[0] || "Dataset quality supports core analysis.",
      content_md: warnings.join("\n") || "This dataset supports the core activation, concentration, and efficiency views.",
      conclusion_status: warnings.length > 0 ? "warning" : "good",
      key_findings: [],
    },
    10: {
      title: "Appendix - Methodology",
      conclusion: "KPIs are computed from uploaded partner-level performance data.",
      content_md: "Metrics are based on revenue, clicks, orders/actions, and commission/action cost fields where available.",
      conclusion_status: "neutral",
      key_findings: [],
    },
  };
  return sections[sectionId];
}

async function generateSectionWithAi({ sectionId, dataset, metrics, evidenceTables, brandContext, warnings, findings }) {
  const unsupported =
    (sectionId === 3 && !dataset.capabilities?.has_publisher_type) ||
    (sectionId === 4 && !dataset.capabilities?.has_commission) ||
    (sectionId === 5 && !dataset.capabilities?.has_approval_breakdown);

  if (unsupported) {
    return { ...fallbackSection(sectionId, dataset, metrics, warnings, brandContext), ai_generated: false };
  }

  try {
    const result = await openAiJson({
      system:
        "You are an affiliate-growth strategy analyst. Keep analysis concise, grounded in the supplied evidence, and suitable for an executive dashboard.",
      prompt: buildSectionPrompt({ sectionId, dataset, metrics, evidenceTables, brandContext, warnings, findings }),
      schemaName: `report_section_${sectionId}`,
      schema: sectionSchema(),
      temperature: 0.2,
    });
    return { ...result, ai_generated: true };
  } catch {
    return { ...fallbackSection(sectionId, dataset, metrics, warnings, brandContext), ai_generated: false };
  }
}

export async function generateSections({ dataset, metrics, evidenceTables, warnings, sectionIds = DEFAULT_SECTION_IDS }) {
  const findings = summarizeFindings(metrics, dataset.website_scrape_data || {});

  const generated = await Promise.all(
    sectionIds.map(async (sectionId) => {
      const section = await generateSectionWithAi({
        sectionId,
        dataset,
        metrics,
        evidenceTables,
        brandContext: dataset.website_scrape_data || {},
        warnings,
        findings,
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
  const findings = sections
    .flatMap((section) => section.key_findings || [])
    .filter((item) => item.type === "risk" || item.type === "opportunity")
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
  await persist();

  const dataset = db.DataUpload[datasetIndex];
  const parseResult = parseDatasetRows({
    datasetId: dataset.id,
    rows: dataset.source_rows || [],
    headers: dataset.source_headers || [],
    fieldMapping: field_mapping,
    cleaningOptions: cleaning_options,
  });

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

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    row_count: parseResult.row_count,
    field_mapping: parseResult.field_mapping,
    capabilities: parseResult.capabilities,
    processing_warnings: parseResult.warnings,
    processing_progress: 28,
    processing_step: "Researching brand context",
  };
  db.Job[0] = {
    ...db.Job[0],
    stage: "brand_research",
    progress: 30,
    updated_date: new Date().toISOString(),
  };
  await persist();

  const domain = new URL(dataset.website_url || "https://www.insta360.com").hostname.replace(/^www\./, "");
  const cachedBrand = (db.BrandResearchCache || []).find((item) => item.domain === domain);
  const brandContext = cachedBrand?.payload || await researchBrand(dataset.website_url || "https://www.insta360.com");
  if (!cachedBrand) {
    db.BrandResearchCache.push({
      id: uid("brandcache"),
      domain,
      payload: brandContext,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });
  }
  const capabilities = createCapabilities(parseResult.field_mapping, true);
  let warnings = buildDatasetWarnings(capabilities, parseResult.field_mapping);

  if (!capabilities.has_publisher_type) {
    db.DataUpload[datasetIndex] = {
      ...db.DataUpload[datasetIndex],
      processing_progress: 42,
      processing_step: "Researching publisher types online",
      website_scrape_data: brandContext,
    };
    db.Job[0] = {
      ...db.Job[0],
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
  }

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    website_scrape_data: brandContext,
    capabilities,
    processing_warnings: warnings,
    processing_progress: 55,
    processing_step: "Computing metrics",
  };
  db.Job[0] = {
    ...db.Job[0],
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

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    processing_progress: 72,
    processing_step: "Generating AI sections",
    processing_warnings: computeResult.warnings,
  };
  db.Job[0] = {
    ...db.Job[0],
    stage: "ai_sections",
    progress: 72,
    updated_date: new Date().toISOString(),
  };
  await persist();

  const refreshedDataset = db.DataUpload[datasetIndex];
  const sectionResult = await generateSections({
    dataset: refreshedDataset,
    metrics: db.MetricSnapshot.filter((item) => item.dataset_id === dataset.id),
    evidenceTables: db.EvidenceTable.filter((item) => item.dataset_id === dataset.id),
    warnings: computeResult.warnings,
  });

  db.ReportSection.push(...sectionResult.sections);
  db.ActionItem = db.ActionItem.filter((item) => item.dataset_id !== dataset.id);
  db.ActionItem.push(
    ...createActionItemsFromFindings(sectionResult.sections).map((item) => ({
      ...item,
      dataset_id: dataset.id,
    }))
  );

  db.DataUpload[datasetIndex] = {
    ...db.DataUpload[datasetIndex],
    status: "completed",
    processing_progress: 100,
    processing_step: "Completed",
    processing_completed_at: new Date().toISOString(),
    sections_ready: sectionResult.generated_sections,
    processing_warnings: computeResult.warnings,
  };
  db.Job[0] = {
    ...db.Job[0],
    status: "completed",
    stage: "done",
    progress: 100,
    updated_date: new Date().toISOString(),
  };
  await persist();

  return {
    success: true,
    warnings: computeResult.warnings,
    steps: {
      parse: {
        success: true,
        row_count: parseResult.row_count,
        publisher_count: parseResult.publisher_count,
        field_mapping: parseResult.field_mapping,
        capabilities,
        warnings: parseResult.warnings,
      },
      compute: {
        success: true,
        metrics_summary: computeResult.summary,
        warnings: computeResult.warnings,
      },
      ai_generate: {
        success: true,
        generated_sections: sectionResult.generated_sections,
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

    if (section.content_md) {
      drawParagraph(section.content_md, { fontSize: 10.5, color: slate, lineHeight: 5.2, bottomGap: 3 });
    }

    if (section.key_findings?.length) {
      drawParagraph("Key Findings", { fontSize: 11, style: "bold", color: slate, topGap: 1, bottomGap: 2 });
      section.key_findings.forEach((finding, index) => drawFindingCard(finding, index));
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
