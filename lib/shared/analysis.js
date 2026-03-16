import { parseNumeric, normalizeFieldMapping } from "./csv.js";

const NUMERIC_FIELDS = [
  "total_revenue",
  "total_commission",
  "clicks",
  "orders",
  "approved_revenue",
  "pending_revenue",
  "declined_revenue",
  "aov",
  "cvr",
];

export const DEFAULT_SECTION_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function createCapabilities(mapping = {}, brandContext = false) {
  const values = Object.values(mapping);
  return {
    has_approval_breakdown: values.some((value) =>
      ["approved_revenue", "pending_revenue", "declined_revenue"].includes(value)
    ),
    has_publisher_type: values.includes("publisher_type"),
    has_orders: values.includes("orders"),
    has_commission: values.includes("total_commission"),
    has_clicks: values.includes("clicks"),
    has_brand_context: !!brandContext,
  };
}

export function buildDatasetWarnings(capabilities, mapping) {
  const warnings = [];
  if (!Object.values(mapping).includes("publisher_name")) {
    warnings.push("Source file did not provide a canonical publisher_name column; using fallback mapping.");
  }
  if (!capabilities.has_approval_breakdown) {
    warnings.push("Approval breakdown columns were not present. Approval module will be marked partial.");
  }
  if (!capabilities.has_publisher_type) {
    warnings.push("Publisher type column was not present. Mix Health module will be marked partial.");
  }
  if (!capabilities.has_orders) {
    warnings.push("Order/action volume was not present. Conversion-based insights may be limited.");
  }
  if (!capabilities.has_commission) {
    warnings.push("Commission or action cost was not present. Cost-efficiency insights may be limited.");
  }
  return warnings;
}

export function parseDatasetRows({ datasetId, rows = [], headers = [], fieldMapping = {}, cleaningOptions = {} }) {
  const resolvedMapping = Object.keys(fieldMapping || {}).length > 0 ? fieldMapping : normalizeFieldMapping(headers);
  const capabilities = createCapabilities(resolvedMapping, false);
  const publishers = [];
  const seen = new Set();

  rows.forEach((row) => {
    const publisher = { dataset_id: datasetId };
    let hasName = false;
    let hasMetric = false;

    Object.entries(resolvedMapping).forEach(([sourceField, targetField]) => {
      if (!targetField) return;
      const rawValue = row?.[sourceField];
      const value = NUMERIC_FIELDS.includes(targetField) ? parseNumeric(rawValue) : rawValue;
      publisher[targetField] = value;
      if (targetField === "publisher_name" && value) hasName = true;
      if (["total_revenue", "orders", "clicks", "total_commission"].includes(targetField) && rawValue != null && rawValue !== "") {
        hasMetric = true;
      }
    });

    if (!publisher.publisher_name) {
      publisher.publisher_name =
        row.Partner || row.partner || row.Name || row.name || row.Publisher || row.publisher || null;
      if (publisher.publisher_name) hasName = true;
    }

    if (!hasName || !hasMetric) return;

    publisher.publisher_id_norm =
      publisher.publisher_id ||
      [
        String(publisher.publisher_name).toLowerCase().replace(/\s+/g, "_"),
        parseNumeric(publisher.clicks),
        parseNumeric(publisher.orders),
        parseNumeric(publisher.total_revenue),
        parseNumeric(publisher.total_commission),
      ].join("__");

    if (cleaningOptions.removeDuplicates && seen.has(publisher.publisher_id_norm)) return;
    seen.add(publisher.publisher_id_norm);

    if (cleaningOptions.filterLowGMV && parseNumeric(publisher.total_revenue) < Number(cleaningOptions.minGMV || 0)) {
      return;
    }

    publishers.push(publisher);
  });

  return {
    row_count: rows.length,
    publisher_count: publishers.length,
    publishers,
    field_mapping: resolvedMapping,
    capabilities,
    warnings: buildDatasetWarnings(capabilities, resolvedMapping),
  };
}

function metric(metric_key, value_num, module_id) {
  return { metric_key, value_num, module_id };
}

function evidence(table_key, data_json, module_id, extra = {}) {
  return { table_key, data_json, module_id, row_count: data_json.length, ...extra };
}

export function computeDatasetArtifacts({ publishers = [], capabilities = {}, datasetWarnings = [] }) {
  const warnings = [...datasetWarnings];
  const total_publishers = publishers.length;
  const activePublishers = publishers.filter((publisher) => (publisher.total_revenue || 0) > 0);
  const active_publishers = activePublishers.length;
  const active_ratio = total_publishers > 0 ? active_publishers / total_publishers : 0;
  const total_gmv = publishers.reduce((sum, publisher) => sum + (publisher.total_revenue || 0), 0);
  const gmv_per_active = active_publishers > 0 ? total_gmv / active_publishers : 0;
  const total_clicks = publishers.reduce((sum, publisher) => sum + (publisher.clicks || 0), 0);
  const total_orders = publishers.reduce((sum, publisher) => sum + (publisher.orders || 0), 0);
  const total_commission = publishers.reduce((sum, publisher) => sum + (publisher.total_commission || 0), 0);

  const metrics = [
    metric("total_publishers", total_publishers, 0),
    metric("active_publishers", active_publishers, 1),
    metric("active_ratio", active_ratio, 1),
    metric("total_gmv", total_gmv, 0),
    metric("gmv_per_active", gmv_per_active, 0),
    metric("total_clicks", total_clicks, 0),
    metric("total_orders", total_orders, 0),
    metric("total_commission", total_commission, 0),
  ];

  const evidenceTables = [
    evidence(
      "activation_summary",
      [
        { label: "Total Publishers", value: total_publishers },
        { label: "Active Publishers", value: active_publishers },
        { label: "Active Ratio", value: `${(active_ratio * 100).toFixed(1)}%` },
        { label: "GMV per Active", value: `$${gmv_per_active.toFixed(0)}` },
        { label: "Clicks", value: total_clicks },
        { label: "Orders", value: total_orders },
        { label: "Commission / Action Cost", value: `$${total_commission.toFixed(2)}` },
      ],
      1
    ),
  ];

  const sorted = [...activePublishers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
  const top1_share = total_gmv > 0 ? (sorted[0]?.total_revenue || 0) / total_gmv : 0;
  const top10_share =
    total_gmv > 0 ? sorted.slice(0, 10).reduce((sum, publisher) => sum + (publisher.total_revenue || 0), 0) / total_gmv : 0;
  let cumulative = 0;
  let publishers_to_50pct = 0;
  for (const publisher of sorted) {
    cumulative += publisher.total_revenue || 0;
    publishers_to_50pct += 1;
    if (cumulative >= total_gmv * 0.5) break;
  }

  metrics.push(metric("top1_share", top1_share, 2));
  metrics.push(metric("top10_share", top10_share, 2));
  metrics.push(metric("publishers_to_50pct", publishers_to_50pct, 2));

  evidenceTables.push(
    evidence(
      "topn_table",
      sorted.slice(0, 20).map((publisher, index) => ({
        rank: index + 1,
        name: publisher.publisher_name || publisher.publisher_id,
        gmv: `$${((publisher.total_revenue || 0) / 1000).toFixed(1)}K`,
        pct: `${total_gmv > 0 ? (((publisher.total_revenue || 0) / total_gmv) * 100).toFixed(1) : "0.0"}%`,
        cumPct: `${total_gmv > 0 ? ((sorted.slice(0, index + 1).reduce((sum, item) => sum + (item.total_revenue || 0), 0) / total_gmv) * 100).toFixed(1) : "0.0"}%`,
      })),
      2
    )
  );

  const paretoPoints = [];
  let running = 0;
  sorted.forEach((publisher, index) => {
    running += publisher.total_revenue || 0;
    if (sorted.length === 0) return;
    if (index % Math.max(1, Math.ceil(sorted.length / 20)) === 0 || index === sorted.length - 1) {
      paretoPoints.push({
        pubPct: (((index + 1) / sorted.length) * 100).toFixed(1),
        gmvPct: `${total_gmv > 0 ? ((running / total_gmv) * 100).toFixed(1) : "0.0"}`,
      });
    }
  });
  evidenceTables.push(evidence("pareto_points", paretoPoints, 2));

  if (capabilities.has_publisher_type) {
    const buckets = {};
    activePublishers.forEach((publisher) => {
      const key = publisher.publisher_type || "other";
      if (!buckets[key]) buckets[key] = { count: 0, gmv: 0 };
      buckets[key].count += 1;
      buckets[key].gmv += publisher.total_revenue || 0;
    });
    const mixData = Object.entries(buckets).map(([type, data]) => ({
      type,
      count: data.count,
      gmv: data.gmv,
      count_share: active_publishers > 0 ? ((data.count / active_publishers) * 100).toFixed(1) : "0.0",
      gmv_share: total_gmv > 0 ? ((data.gmv / total_gmv) * 100).toFixed(1) : "0.0",
    }));
    evidenceTables.push(evidence("mix_health_table", mixData, 3));
  } else {
    evidenceTables.push(evidence("mix_health_table", [], 3, { partial: true, notes: "Publisher type data is unavailable for this dataset." }));
  }

  if (capabilities.has_approval_breakdown) {
    const total_approved = publishers.reduce((sum, publisher) => sum + (publisher.approved_revenue || 0), 0);
    const total_pending = publishers.reduce((sum, publisher) => sum + (publisher.pending_revenue || 0), 0);
    const total_declined = publishers.reduce((sum, publisher) => sum + (publisher.declined_revenue || 0), 0);
    const approval_rate = total_gmv > 0 ? total_approved / total_gmv : 0;
    metrics.push(metric("approval_rate", approval_rate, 5));
    metrics.push(metric("total_approved_gmv", total_approved, 5));
    metrics.push(metric("total_pending_gmv", total_pending, 5));
    metrics.push(metric("total_declined_gmv", total_declined, 5));
    evidenceTables.push(
      evidence(
        "approval_waterfall",
        [
          { name: "Total GMV", value: total_gmv, label: `$${(total_gmv / 1000).toFixed(0)}K` },
          { name: "Approved", value: total_approved, label: `$${(total_approved / 1000).toFixed(0)}K` },
          { name: "Pending", value: total_pending, label: `$${(total_pending / 1000).toFixed(0)}K` },
          { name: "Declined", value: total_declined, label: `$${(total_declined / 1000).toFixed(0)}K` },
        ],
        5
      )
    );
    evidenceTables.push(
      evidence(
        "approval_table",
        publishers
          .filter((publisher) => (publisher.total_revenue || 0) > 0)
          .map((publisher) => ({
            publisher_name: publisher.publisher_name || publisher.publisher_id || "Unknown",
            total_revenue: publisher.total_revenue || 0,
            approved_revenue: publisher.approved_revenue || 0,
            pending_revenue: publisher.pending_revenue || 0,
            declined_revenue: publisher.declined_revenue || 0,
            approval_rate:
              (publisher.total_revenue || 0) > 0 ? (publisher.approved_revenue || 0) / (publisher.total_revenue || 0) : 0,
            decline_rate:
              (publisher.total_revenue || 0) > 0 ? (publisher.declined_revenue || 0) / (publisher.total_revenue || 0) : 0,
          })),
        5
      )
    );
  } else {
    warnings.push("Approval breakdown was unavailable, so approval charts were marked partial.");
    metrics.push(metric("approval_rate", 0, 5));
    metrics.push(metric("total_approved_gmv", 0, 5));
    metrics.push(metric("total_pending_gmv", 0, 5));
    metrics.push(metric("total_declined_gmv", 0, 5));
    evidenceTables.push(evidence("approval_waterfall", [], 5, { partial: true, notes: "Approval breakdown is unavailable." }));
    evidenceTables.push(evidence("approval_table", [], 5, { partial: true, notes: "Approval detail rows are unavailable." }));
  }

  return {
    metrics,
    evidenceTables,
    warnings: Array.from(new Set(warnings)),
    summary: {
      total_publishers,
      active_publishers,
      active_ratio,
      total_gmv,
      top10_share,
      publishers_to_50pct,
      total_clicks,
      total_orders,
      total_commission,
    },
  };
}

export function getMetricValue(metrics = [], key) {
  return metrics.find((item) => item.metric_key === key)?.value_num || 0;
}

export function summarizeFindings(metrics = [], brandContext = {}) {
  const activeRatio = getMetricValue(metrics, "active_ratio");
  const top10Share = getMetricValue(metrics, "top10_share");
  const totalGMV = getMetricValue(metrics, "total_gmv");
  const totalOrders = getMetricValue(metrics, "total_orders");
  const risks = [];
  const opportunities = [];

  if (activeRatio < 0.4) {
    risks.push({
      type: "risk",
      title: "Active publisher ratio is low",
      trigger: `Only ${(activeRatio * 100).toFixed(1)}% of partners are generating revenue.`,
      action: "Re-activate dormant partners with targeted outreach, seasonal promos, and creative refreshes.",
      owner: "Affiliate Manager",
      deadline: "30 days",
      linkPage: "Activation",
    });
  }

  if (top10Share > 0.7) {
    risks.push({
      type: "risk",
      title: "Revenue concentration is extreme",
      trigger: `Top 10 partners contribute ${(top10Share * 100).toFixed(1)}% of GMV.`,
      action: "Grow the mid-tier partner base and recruit new creator/content partners to diversify revenue.",
      owner: "Partnerships",
      deadline: "60 days",
      linkPage: "Concentration",
    });
  }

  if (totalOrders > 0) {
    opportunities.push({
      type: "opportunity",
      title: "Scale proven order-driving partners",
      trigger: `${totalOrders.toFixed(0)} total actions show demand already exists in-channel.`,
      action: "Shift promos, exclusives, and landing pages toward partners with order volume but low share.",
      owner: "Growth",
      deadline: "45 days",
      linkPage: "Efficiency",
    });
  }

  if (brandContext?.brand_name) {
    opportunities.push({
      type: "opportunity",
      title: `Align partner content to ${brandContext.brand_name} use cases`,
      trigger: `${brandContext.brand_name} positioning leans on creator storytelling and product-led demonstrations.`,
      action: "Package product hooks, hero SKUs, and creator briefs so publishers can produce better conversion content.",
      owner: "Content Lead",
      deadline: "30 days",
      linkPage: "ActionPlan",
    });
  }

  return { risks, opportunities, totalGMV };
}

export function markdownFromSections(dataset, sections, metrics) {
  const parts = [
    "# Affiliate Growth Intelligence Report",
    "",
    `Dataset: ${dataset.version_label || dataset.file_name}`,
    `Generated: ${new Date().toLocaleString()}`,
    `Brand: ${dataset.website_scrape_data?.brand_name || dataset.website_url || "N/A"}`,
    "",
    "## Core KPIs",
    `- Active Ratio: ${(getMetricValue(metrics, "active_ratio") * 100).toFixed(1)}%`,
    `- Total GMV: $${getMetricValue(metrics, "total_gmv").toFixed(2)}`,
    `- Top10 Share: ${(getMetricValue(metrics, "top10_share") * 100).toFixed(1)}%`,
    `- Total Orders: ${getMetricValue(metrics, "total_orders").toFixed(0)}`,
    `- Total Commission: $${getMetricValue(metrics, "total_commission").toFixed(2)}`,
    "",
  ];

  [...sections]
    .sort((a, b) => a.section_id - b.section_id)
    .forEach((section) => {
      parts.push(`## ${section.section_id}. ${section.title}`);
      if (section.conclusion) parts.push(section.conclusion, "");
      if (section.content_md) parts.push(section.content_md, "");
      if (section.key_findings?.length) {
        parts.push("### Key Findings");
        section.key_findings.forEach((finding, index) => {
          if (typeof finding === "string") {
            parts.push(`${index + 1}. ${finding}`);
            return;
          }
          parts.push(`${index + 1}. ${finding.title || "Finding"}`);
          if (finding.type) parts.push(`   - Type: ${finding.type}`);
          if (finding.trigger) parts.push(`   - Trigger: ${finding.trigger}`);
          if (finding.action) parts.push(`   - Action: ${finding.action}`);
          if (finding.owner) parts.push(`   - Owner: ${finding.owner}`);
          if (finding.deadline) parts.push(`   - Deadline: ${finding.deadline}`);
          if (finding.linkPage) parts.push(`   - Related Page: ${finding.linkPage}`);
        });
        parts.push("");
      }
    });

  return parts.join("\n");
}
