import { supabase, isSupabaseEnabled } from "@/lib/supabaseClient";

const listeners = {
  DataUpload: new Set(),
};

const pollers = new Map();

const nowIso = () => new Date().toISOString();
const makeId = () => (globalThis.crypto?.randomUUID?.() || `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

function ensureSupabase() {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

function emit(entity, type, data) {
  for (const cb of listeners[entity] || []) {
    try {
      cb({ type, id: data?.id || data?.dataset_id, data });
    } catch {
      // noop
    }
  }
}

async function listDatasets(limit = 50) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("dataset_runs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.dataset_id,
    file_name: row.file_name,
    version_label: row.version_label,
    status: row.status,
    processing_progress: row.processing_progress || 0,
    processing_step: row.processing_step,
    sections_ready: row.sections_ready || [],
    field_mapping: row.field_mapping || {},
    row_count: row.row_count || 0,
    created_date: row.updated_at,
    updated_date: row.updated_at,
  }));
}

async function upsertDataset(row) {
  ensureSupabase();
  const payload = {
    dataset_id: row.id,
    file_name: row.file_name || null,
    version_label: row.version_label || null,
    status: row.status || "pending",
    processing_progress: row.processing_progress ?? 0,
    processing_step: row.processing_step || null,
    sections_ready: row.sections_ready || [],
    field_mapping: row.field_mapping || {},
    row_count: row.row_count || 0,
    updated_at: nowIso(),
  };
  const { error } = await supabase.from("dataset_runs").upsert(payload, { onConflict: "dataset_id" });
  if (error) throw error;
}

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normType(v) {
  const k = String(v || "other").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "other";
  if (k === "deal" || k === "coupon" || k === "deal_coupon") return "deal_coupon";
  return k;
}

function inferMapping(headers = []) {
  const map = {};
  const known = {
    publisher_id: ["publisher_id", "publisherid", "pub_id", "id"],
    publisher_name: ["publisher_name", "publishername", "name", "publisher"],
    total_revenue: ["total_revenue", "revenue", "gmv", "total_gmv", "sales"],
    total_commission: ["total_commission", "commission", "payout"],
    orders: ["orders", "num_orders", "transactions", "conversions"],
    approved_revenue: ["approved_revenue", "approved", "approved_sales"],
    pending_revenue: ["pending_revenue", "pending"],
    declined_revenue: ["declined_revenue", "declined", "reversed_revenue"],
    publisher_type: ["publisher_type", "type", "category", "publisher_category"],
  };
  for (const h of headers) {
    const hl = String(h).toLowerCase();
    for (const [target, aliases] of Object.entries(known)) {
      if (!map[target] && aliases.includes(hl)) map[target] = h;
    }
  }
  return map;
}

function sanitizeRows(rows = [], mapping = {}, headers = []) {
  const sourceByTarget = Object.keys(mapping).length > 0
    ? Object.entries(mapping).reduce((acc, [source, target]) => {
        if (source && target) acc[target] = source;
        return acc;
      }, {})
    : inferMapping(headers);

  const get = (row, key) => row[sourceByTarget[key]];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const clean = {
      publisher_id: get(row, "publisher_id") || null,
      publisher_name: get(row, "publisher_name") || "Unknown",
      publisher_type: get(row, "publisher_type") || "other",
      total_revenue: toNum(get(row, "total_revenue")),
      total_commission: toNum(get(row, "total_commission")),
      orders: toNum(get(row, "orders")),
      approved_revenue: toNum(get(row, "approved_revenue")),
      pending_revenue: toNum(get(row, "pending_revenue")),
      declined_revenue: toNum(get(row, "declined_revenue")),
    };
    const dedupe = clean.publisher_id || String(clean.publisher_name).toLowerCase().replace(/\s+/g, "_");
    if (!dedupe || seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(clean);
  }
  return { rows: out, sourceByTarget };
}

async function overwriteAnalysis(datasetId, metrics, tables, sections) {
  ensureSupabase();
  await supabase.from("analysis_metrics").delete().eq("dataset_id", datasetId);
  await supabase.from("analysis_evidence_tables").delete().eq("dataset_id", datasetId);
  await supabase.from("analysis_sections").delete().eq("dataset_id", datasetId);

  if (metrics.length) {
    const { error } = await supabase.from("analysis_metrics").insert(metrics);
    if (error) throw error;
  }
  if (tables.length) {
    const { error } = await supabase.from("analysis_evidence_tables").insert(tables);
    if (error) throw error;
  }
  if (sections.length) {
    const { error } = await supabase.from("analysis_sections").insert(sections);
    if (error) throw error;
  }
}

function genSections(datasetId, m) {
  const get = (k) => m[k] || 0;
  const activeRatio = get("active_ratio");
  const top10Share = get("top10_share");
  const approvalRate = get("approval_rate");
  const content = get("content_share");
  const deal = get("deal_coupon_share");

  const mk = (section_id, conclusion) => ({
    dataset_id: datasetId,
    section_id,
    title: `Section ${section_id}`,
    conclusion,
    conclusion_status: "neutral",
    content_md: conclusion,
    key_findings: [],
    derivation_notes: [
      "输入字段: publisher_name,total_revenue,total_commission,orders,approved/pending/declined_revenue",
      "公式: active_ratio=active/total, top10_share=top10/total_gmv, approval_rate=approved/total_gmv",
    ],
    ai_generated: true,
    updated_at: nowIso(),
  });

  return [
    mk(0, `活跃率 ${(activeRatio * 100).toFixed(1)}%，Top10 ${(top10Share * 100).toFixed(1)}%，Approval ${(approvalRate * 100).toFixed(1)}%。`),
    mk(1, `激活漏斗显示 Active Ratio ${(activeRatio * 100).toFixed(1)}%。`),
    mk(2, `集中度为 ${(top10Share * 100).toFixed(1)}%，需持续去集中化。`),
    mk(3, `结构健康：Content ${(content * 100).toFixed(1)}%，Deal/Coupon ${(deal * 100).toFixed(1)}%。`),
    mk(4, "效率象限已按最新数据重算。"),
    mk(5, `交易审批率 ${(approvalRate * 100).toFixed(1)}%。`),
    mk(6, "分层治理已按最新数据集更新。"),
    mk(7, "行动计划应优先聚焦激活、去集中化与审批治理。"),
    mk(8, "时间线任务已根据当前风险自动生成。"),
    mk(9, "官网分析模块需要额外网页抓取输入。"),
    mk(10, "建议按KPI周更并滚动复盘。"),
  ];
}

async function processDataset(payload = {}) {
  ensureSupabase();
  const datasetId = payload.dataset_id;
  if (!datasetId) throw new Error("Missing dataset_id");
  const parsedRows = payload.parsed_rows || [];
  const parsedHeaders = payload.parsed_headers || [];
  const fieldMapping = payload.field_mapping || {};

  await upsertDataset({
    id: datasetId,
    file_name: payload.file_name || null,
    version_label: payload.version_label || null,
    status: "processing",
    processing_progress: 10,
    processing_step: "Parsing CSV...",
    sections_ready: [],
    field_mapping: fieldMapping,
    row_count: parsedRows.length,
  });

  const { rows } = sanitizeRows(parsedRows, fieldMapping, parsedHeaders);
  await upsertDataset({
    id: datasetId,
    status: "processing",
    processing_progress: 35,
    processing_step: "清洗数据并构建指标...",
    sections_ready: [],
    field_mapping: fieldMapping,
    row_count: parsedRows.length,
  });
  const total = rows.length;
  const activeRows = rows.filter((r) => r.total_revenue > 0);
  const active = activeRows.length;
  const totalGMV = rows.reduce((s, r) => s + r.total_revenue, 0);
  const activeRatio = total > 0 ? active / total : 0;
  const gmvPerActive = active > 0 ? totalGMV / active : 0;

  const sorted = [...activeRows].sort((a, b) => b.total_revenue - a.total_revenue);
  const top1 = sorted[0]?.total_revenue || 0;
  const top10 = sorted.slice(0, 10).reduce((s, r) => s + r.total_revenue, 0);
  const top1Share = totalGMV > 0 ? top1 / totalGMV : 0;
  const top10Share = totalGMV > 0 ? top10 / totalGMV : 0;
  let cum = 0;
  let to50 = 0;
  for (const r of sorted) {
    cum += r.total_revenue;
    to50 += 1;
    if (cum >= totalGMV * 0.5) break;
  }

  const approved = rows.reduce((s, r) => s + r.approved_revenue, 0);
  const pending = rows.reduce((s, r) => s + r.pending_revenue, 0);
  const declined = rows.reduce((s, r) => s + r.declined_revenue, 0);
  const approvalRate = totalGMV > 0 ? approved / totalGMV : 0;

  const typeBuckets = {};
  activeRows.forEach((r) => {
    const k = normType(r.publisher_type);
    if (!typeBuckets[k]) typeBuckets[k] = { type: k, count: 0, gmv: 0 };
    typeBuckets[k].count += 1;
    typeBuckets[k].gmv += r.total_revenue;
  });
  const mixRows = Object.values(typeBuckets).map((r) => ({
    type: r.type,
    count: r.count,
    gmv: r.gmv,
    count_share: `${active > 0 ? ((r.count / active) * 100).toFixed(1) : "0.0"}%`,
    gmv_share: `${totalGMV > 0 ? ((r.gmv / totalGMV) * 100).toFixed(1) : "0.0"}%`,
  }));

  const metrics = [
    ["total_publishers", total, 0],
    ["active_publishers", active, 1],
    ["active_ratio", activeRatio, 1],
    ["total_gmv", totalGMV, 0],
    ["gmv_per_active", gmvPerActive, 0],
    ["top1_share", top1Share, 2],
    ["top10_share", top10Share, 2],
    ["publishers_to_50pct", to50, 2],
    ["approval_rate", approvalRate, 5],
    ["total_approved_gmv", approved, 5],
    ["total_pending_gmv", pending, 5],
    ["total_declined_gmv", declined, 5],
  ].map(([metric_key, value_num, module_id]) => ({
    dataset_id: datasetId,
    metric_key,
    value_num,
    module_id,
    calc_version: nowIso(),
    updated_at: nowIso(),
  }));

  mixRows.forEach((row) => {
    metrics.push({
      dataset_id: datasetId,
      metric_key: `${row.type}_share`,
      value_num: totalGMV > 0 ? row.gmv / totalGMV : 0,
      module_id: 3,
      calc_version: nowIso(),
      updated_at: nowIso(),
    });
  });

  let runningCum = 0;
  const topn = sorted.slice(0, 20).map((r, i) => {
    runningCum += r.total_revenue;
    return {
      rank: i + 1,
      name: r.publisher_name,
      gmv: `$${(r.total_revenue / 1000).toFixed(1)}K`,
      pct: `${totalGMV > 0 ? ((r.total_revenue / totalGMV) * 100).toFixed(1) : "0.0"}%`,
      cumPct: `${totalGMV > 0 ? ((runningCum / totalGMV) * 100).toFixed(1) : "0.0"}%`,
    };
  });

  let paretoCum = 0;
  const pace = Math.max(1, Math.ceil(sorted.length / 20));
  const pareto = [];
  sorted.forEach((r, i) => {
    paretoCum += r.total_revenue;
    if (i % pace === 0 || i === sorted.length - 1) {
      pareto.push({
        pubPct: (((i + 1) / Math.max(1, sorted.length)) * 100).toFixed(1),
        gmvPct: (totalGMV > 0 ? (paretoCum / totalGMV) * 100 : 0).toFixed(1),
      });
    }
  });

  const tierBase = [...rows].sort((a, b) => b.total_revenue - a.total_revenue);
  const tierRows = tierBase.map((r, idx) => ({
    ...r,
    tier: r.total_revenue <= 0 ? "Tier 4" : idx < 10 ? "Tier 1" : idx < 50 ? "Tier 2" : "Tier 3",
  }));
  const tierSummary = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"].map((tier) => {
    const part = tierRows.filter((r) => r.tier === tier);
    const gmv = part.reduce((s, r) => s + r.total_revenue, 0);
    return {
      tier,
      count: part.length,
      gmv,
      gmv_share: totalGMV > 0 ? gmv / totalGMV : 0,
      top_publishers: part.sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5).map((r) => r.publisher_name),
    };
  });

  const tables = [
    ["activation_publishers", sorted.slice(0, 100).map((r) => ({
      name: r.publisher_name,
      type: r.publisher_type,
      gmv: r.total_revenue,
      cpa: r.orders > 0 ? r.total_commission / r.orders : 0,
      approval_rate: r.total_revenue > 0 ? r.approved_revenue / r.total_revenue : 0,
      status: "Active",
    })), 1],
    ["topn_table", topn, 2],
    ["pareto_points", pareto, 2],
    ["mix_health_table", mixRows, 3],
    ["efficiency_scatter", sorted.map((r) => ({
      name: r.publisher_name,
      type: normType(r.publisher_type),
      cpa: r.orders > 0 ? Number((r.total_commission / r.orders).toFixed(2)) : 0,
      aov: r.orders > 0 ? Number((r.total_revenue / r.orders).toFixed(2)) : 0,
      roi: r.total_commission > 0 ? Number((r.total_revenue / r.total_commission).toFixed(2)) : 0,
      gmv: r.total_revenue,
    })), 4],
    ["approval_table", sorted.map((r) => ({
      publisher_name: r.publisher_name,
      total_revenue: r.total_revenue,
      approved_revenue: r.approved_revenue,
      pending_revenue: r.pending_revenue,
      declined_revenue: r.declined_revenue,
      approval_rate: r.total_revenue > 0 ? r.approved_revenue / r.total_revenue : 0,
      decline_rate: r.total_revenue > 0 ? r.declined_revenue / r.total_revenue : 0,
    })).sort((a, b) => b.decline_rate - a.decline_rate), 5],
    ["tier_summary", tierSummary, 6],
    ["timeline_tasks", [
      { name: `激活提升计划（目标活跃率 ${(Math.max(activeRatio, 0.4) * 100).toFixed(0)}%）`, month_start: 1, duration: 3, priority: activeRatio < 0.4 ? "high" : "medium" },
      { name: `去集中化计划（Top10 ${(top10Share * 100).toFixed(0)}%）`, month_start: 2, duration: 4, priority: top10Share > 0.5 ? "high" : "medium" },
      { name: `审批治理（Approval ${(approvalRate * 100).toFixed(0)}%）`, month_start: 3, duration: 2, priority: approvalRate < 0.85 ? "high" : "medium" },
      { name: "结构优化与季度复盘", month_start: 6, duration: 3, priority: "medium" },
    ], 8],
  ].map(([table_key, data_json, module_id]) => ({
    dataset_id: datasetId,
    table_key,
    data_json,
    module_id,
    row_count: Array.isArray(data_json) ? data_json.length : 0,
    updated_at: nowIso(),
  }));

  const metricMap = Object.fromEntries(metrics.map((r) => [r.metric_key, r.value_num]));
  await upsertDataset({
    id: datasetId,
    status: "processing",
    processing_progress: 70,
    processing_step: "写入证据表与章节...",
    sections_ready: [],
    field_mapping: fieldMapping,
    row_count: parsedRows.length,
  });
  const sections = genSections(datasetId, metricMap);

  await overwriteAnalysis(datasetId, metrics, tables, sections);

  await upsertDataset({
    id: datasetId,
    status: "completed",
    processing_progress: 100,
    processing_step: "Completed",
    sections_ready: Array.from({ length: 11 }, (_, i) => i),
    field_mapping: fieldMapping,
    row_count: parsedRows.length,
  });

  emit("DataUpload", "update", { id: datasetId, status: "completed" });
  return { success: true, dataset_id: datasetId };
}

export const dataClient = {
  auth: {
    async me() {
      return { id: "supabase-anon", role: "admin" };
    },
    logout() {},
    redirectToLogin() {},
  },
  appLogs: {
    async logUserInApp() {
      return true;
    },
  },
  entities: {
    DataUpload: {
      async list(sort = "-created_date", limit = 50) {
        const rows = await listDatasets(limit);
        return sort.startsWith("-") ? rows : [...rows].reverse();
      },
      async filter(query = {}) {
        const rows = await listDatasets(200);
        return rows.filter((r) => Object.entries(query).every(([k, v]) => r[k] === v || (k === "id" && r.id === v)));
      },
      async create(payload = {}) {
        const id = makeId();
        const row = {
          id,
          file_name: payload.file_name || null,
          version_label: payload.version_label || `v${new Date().toISOString().split("T")[0]}`,
          status: payload.status || "pending",
          processing_progress: payload.processing_progress ?? 0,
          processing_step: payload.processing_step || null,
          sections_ready: payload.sections_ready || [],
          field_mapping: payload.field_mapping || {},
          row_count: payload.row_count || 0,
        };
        await upsertDataset(row);
        emit("DataUpload", "create", row);
        return { ...row, created_date: nowIso(), updated_date: nowIso() };
      },
      async update(id, patch = {}) {
        const existing = (await listDatasets(500)).find((r) => r.id === id) || { id };
        const row = { ...existing, ...patch, id };
        await upsertDataset(row);
        emit("DataUpload", "update", row);
        return row;
      },
      subscribe(cb) {
        listeners.DataUpload.add(cb);
        if (!pollers.has("DataUpload")) {
          let latest = "";
          const timer = setInterval(async () => {
            try {
              const rows = await listDatasets(1);
              const top = rows[0];
              const sig = JSON.stringify(top || {});
              if (sig !== latest && top) {
                latest = sig;
                emit("DataUpload", "update", top);
              }
            } catch {
              // noop
            }
          }, 3000);
          pollers.set("DataUpload", timer);
        }
        return () => listeners.DataUpload.delete(cb);
      },
    },
    MetricSnapshot: {
      async filter({ dataset_id }) {
        ensureSupabase();
        const { data, error } = await supabase.from("analysis_metrics").select("*").eq("dataset_id", dataset_id);
        if (error) throw error;
        return (data || []).map((r) => ({ ...r, created_date: r.updated_at, updated_date: r.updated_at }));
      },
    },
    EvidenceTable: {
      async filter({ dataset_id }) {
        ensureSupabase();
        const { data, error } = await supabase.from("analysis_evidence_tables").select("*").eq("dataset_id", dataset_id);
        if (error) throw error;
        return (data || []).map((r) => ({ ...r, created_date: r.updated_at, updated_date: r.updated_at }));
      },
    },
    ReportSection: {
      async filter({ dataset_id }) {
        ensureSupabase();
        const { data, error } = await supabase.from("analysis_sections").select("*").eq("dataset_id", dataset_id);
        if (error) throw error;
        return (data || []).map((r) => ({ ...r, created_date: r.updated_at, updated_date: r.updated_at }));
      },
    },
    ActionItem: {
      async list(sort = "-created_date", limit = 100) {
        ensureSupabase();
        const asc = !sort.startsWith("-");
        const { data, error } = await supabase.from("action_items").select("*").order("created_at", { ascending: asc }).limit(limit);
        if (error) throw error;
        return (data || []).map((r) => ({ ...r, created_date: r.created_at, updated_date: r.updated_at }));
      },
      async create(payload) {
        ensureSupabase();
        const { data, error } = await supabase.from("action_items").insert(payload).select("*").single();
        if (error) throw error;
        return { ...data, created_date: data.created_at, updated_date: data.updated_at };
      },
      async update(id, patch) {
        ensureSupabase();
        const { data, error } = await supabase.from("action_items").update(patch).eq("id", id).select("*").single();
        if (error) throw error;
        return { ...data, created_date: data.created_at, updated_date: data.updated_at };
      },
    },
    Job: {
      async filter() {
        return [];
      },
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        return { file_url: `local://${encodeURIComponent(file?.name || "upload.csv")}` };
      },
    },
  },
  functions: {
    async invoke(name, payload = {}) {
      if (name === "processDataset") return processDataset(payload);
      if (name === "aiGenerateSections") return { success: true };
      if (name === "scrapeWebsite") return { success: true };
      return { success: true };
    },
  },
};
