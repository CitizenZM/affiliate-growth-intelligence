const STORAGE_KEY = "agi_local_store_v1";

const state = {
  listeners: {
    DataUpload: new Set(),
    MetricSnapshot: new Set(),
    EvidenceTable: new Set(),
    ReportSection: new Set(),
    ActionItem: new Set(),
  },
};

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw
    ? safeParse(raw, null)
    : {
        DataUpload: [],
        MetricSnapshot: [],
        EvidenceTable: [],
        ReportSection: [],
        ActionItem: [],
      };
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function notify(entity, type, row) {
  const payload = { type, id: row?.id, data: row };
  for (const cb of state.listeners[entity] || []) {
    try {
      cb(payload);
    } catch {
      // noop
    }
  }
}

function sortRows(rows, sort) {
  if (!sort) return [...rows];
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return desc ? bv - av : av - bv;
    return desc
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv));
  });
}

function matchFilter(row, query = {}) {
  return Object.entries(query).every(([k, v]) => row?.[k] === v);
}

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normTypeKey(v) {
  const key = String(v || "other").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "other";
  if (key === "deal" || key === "coupon" || key === "deal_coupon") return "deal_coupon";
  return key;
}

function buildEntityApi(entity) {
  return {
    async list(sort = "-created_date", limit = 50, skip = 0) {
      const store = loadStore();
      const rows = sortRows(store[entity] || [], sort);
      return rows.slice(skip, skip + limit);
    },
    async filter(query = {}, sort, limit = 200, skip = 0) {
      const store = loadStore();
      const rows = (store[entity] || []).filter((r) => matchFilter(r, query));
      const sorted = sortRows(rows, sort);
      return sorted.slice(skip, skip + limit);
    },
    async get(rowId) {
      const store = loadStore();
      return (store[entity] || []).find((r) => r.id === rowId) || null;
    },
    async create(payload = {}) {
      const store = loadStore();
      const row = {
        id: id(entity.toLowerCase()),
        ...payload,
        created_date: payload.created_date || nowIso(),
        updated_date: nowIso(),
      };
      store[entity] = [...(store[entity] || []), row];
      saveStore(store);
      notify(entity, "create", row);
      return row;
    },
    async update(rowId, patch = {}) {
      const store = loadStore();
      const rows = store[entity] || [];
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx < 0) throw new Error(`${entity} not found: ${rowId}`);
      const row = { ...rows[idx], ...patch, updated_date: nowIso() };
      rows[idx] = row;
      store[entity] = rows;
      saveStore(store);
      notify(entity, "update", row);
      return row;
    },
    async delete(rowId) {
      const store = loadStore();
      const rows = store[entity] || [];
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx < 0) return null;
      const [deleted] = rows.splice(idx, 1);
      store[entity] = rows;
      saveStore(store);
      notify(entity, "delete", deleted);
      return deleted;
    },
    subscribe(cb) {
      state.listeners[entity].add(cb);
      return () => state.listeners[entity].delete(cb);
    },
  };
}

function getMappedValue(row, sourceByTarget, target) {
  const source = sourceByTarget[target];
  return source ? row[source] : undefined;
}

function sanitizeRow(row, sourceByTarget) {
  const revenue = toNum(getMappedValue(row, sourceByTarget, "total_revenue"));
  const commission = toNum(getMappedValue(row, sourceByTarget, "total_commission"));
  const orders = toNum(getMappedValue(row, sourceByTarget, "orders"));
  const approved = toNum(getMappedValue(row, sourceByTarget, "approved_revenue"));
  const pending = toNum(getMappedValue(row, sourceByTarget, "pending_revenue"));
  const declined = toNum(getMappedValue(row, sourceByTarget, "declined_revenue"));
  return {
    publisher_id: getMappedValue(row, sourceByTarget, "publisher_id") || null,
    publisher_name: getMappedValue(row, sourceByTarget, "publisher_name") || "Unknown",
    publisher_type: getMappedValue(row, sourceByTarget, "publisher_type") || "other",
    total_revenue: revenue,
    total_commission: commission,
    orders,
    approved_revenue: approved,
    pending_revenue: pending,
    declined_revenue: declined,
  };
}

function clearByDataset(store, datasetId) {
  store.MetricSnapshot = (store.MetricSnapshot || []).filter((r) => r.dataset_id !== datasetId);
  store.EvidenceTable = (store.EvidenceTable || []).filter((r) => r.dataset_id !== datasetId);
  store.ReportSection = (store.ReportSection || []).filter((r) => r.dataset_id !== datasetId);
}

function pushMetric(store, datasetId, key, value, moduleId = 0) {
  const row = {
    id: id("metric"),
    dataset_id: datasetId,
    metric_key: key,
    value_num: Number.isFinite(value) ? value : 0,
    module_id: moduleId,
    calc_version: nowIso(),
    created_date: nowIso(),
    updated_date: nowIso(),
  };
  store.MetricSnapshot.push(row);
  notify("MetricSnapshot", "create", row);
}

function pushTable(store, datasetId, key, dataJson = [], moduleId = 0) {
  const row = {
    id: id("table"),
    dataset_id: datasetId,
    table_key: key,
    data_json: dataJson,
    module_id: moduleId,
    row_count: Array.isArray(dataJson) ? dataJson.length : 0,
    created_date: nowIso(),
    updated_date: nowIso(),
  };
  store.EvidenceTable.push(row);
  notify("EvidenceTable", "create", row);
}

function pushSection(store, datasetId, sectionId, metrics, tables) {
  const getMetric = (k) => metrics.find((m) => m.metric_key === k)?.value_num || 0;
  const top10Share = getMetric("top10_share");
  const activeRatio = getMetric("active_ratio");
  const approvalRate = getMetric("approval_rate");
  const contentShare = getMetric("content_share");
  const dealShare = getMetric("deal_coupon_share");
  const concRisk = top10Share > 0.5 ? "high" : top10Share > 0.4 ? "medium" : "low";
  const activateRisk = activeRatio < 0.35 ? "high" : activeRatio < 0.45 ? "medium" : "low";
  const qualityRisk = approvalRate < 0.75 ? "high" : approvalRate < 0.85 ? "medium" : "low";

  const titleById = {
    0: "Executive Summary",
    1: "Activation",
    2: "Concentration",
    3: "Mix Health",
    4: "Efficiency",
    5: "Approval",
    6: "Operating System",
    7: "Action Plan",
    8: "Timeline",
    9: "Website",
    10: "Recommendations",
  };

  const conclusions = {
    0: `活跃率 ${(activeRatio * 100).toFixed(1)}%，Top10 占比 ${(top10Share * 100).toFixed(1)}%，审批率 ${(approvalRate * 100).toFixed(1)}%。`,
    1: `激活漏斗显示活跃率 ${(activeRatio * 100).toFixed(1)}%，需持续提升沉默 Publisher 激活。`,
    2: `集中度风险 ${concRisk.toUpperCase()}，Top10 占比 ${(top10Share * 100).toFixed(1)}%。`,
    3: `结构健康中 Content ${(contentShare * 100).toFixed(1)}%，Deal/Coupon ${(dealShare * 100).toFixed(1)}%。`,
    4: `效率象限已按最新数据重算，可基于 CPA/AOV 识别加码与治理名单。`,
    5: `交易质量风险 ${qualityRisk.toUpperCase()}，审批率 ${(approvalRate * 100).toFixed(1)}%。`,
    6: `分层治理已按最新 GMV 排序更新 Tier 分布。`,
    7: `行动计划应优先聚焦激活、去集中化和审批治理。`,
    8: `时间线已按核心风险自动生成优先级任务。`,
    9: `官网分析依赖联网抓取，当前以数据驱动章节为主。`,
    10: `建议按风险优先级推进并每周复盘关键 KPI。`,
  };

  const keyFindings = sectionId === 0
    ? [
        { type: "risk", title: "头部集中度", trigger: `Top10 ${(top10Share * 100).toFixed(1)}%`, action: "启动去集中化计划" },
        { type: "risk", title: "激活率", trigger: `Active ${(activeRatio * 100).toFixed(1)}%`, action: "推进激活专项" },
        { type: "opportunity", title: "结构优化", trigger: `Content ${(contentShare * 100).toFixed(1)}%`, action: "提升 Content 渠道比重" },
      ]
    : [];

  const row = {
    id: id("section"),
    dataset_id: datasetId,
    section_id: sectionId,
    title: titleById[sectionId] || `Section ${sectionId}`,
    ai_generated: true,
    conclusion: conclusions[sectionId],
    conclusion_status: "neutral",
    key_findings: keyFindings,
    derivation_notes: [
      "输入字段: publisher_name, total_revenue, total_commission, orders, approved/pending/declined_revenue",
      "清洗规则: 数值字段转数值，publisher 去重",
      "公式: active_ratio=active/total, top10_share=top10_gmv/total_gmv, approval_rate=approved/total_gmv",
      "阈值: active 40%, top10 50%, approval 85%",
    ],
    content_md: conclusions[sectionId],
    created_date: nowIso(),
    updated_date: nowIso(),
  };
  store.ReportSection.push(row);
  notify("ReportSection", "create", row);
}

async function processDatasetLocal(payload) {
  const { dataset_id: datasetId, parsed_rows: parsedRows = [], parsed_headers: parsedHeaders = [], field_mapping: fieldMapping = {} } = payload || {};
  if (!datasetId) throw new Error("Missing dataset_id");

  const store = loadStore();
  const dataUploads = store.DataUpload || [];
  const idx = dataUploads.findIndex((d) => d.id === datasetId);
  if (idx < 0) throw new Error(`Dataset not found: ${datasetId}`);

  dataUploads[idx] = {
    ...dataUploads[idx],
    status: "processing",
    processing_progress: 10,
    processing_step: "Parsing CSV...",
    processing_started_at: nowIso(),
    updated_date: nowIso(),
  };
  saveStore(store);
  notify("DataUpload", "update", dataUploads[idx]);

  const sourceByTarget = Object.entries(fieldMapping || {}).reduce((acc, [source, target]) => {
    if (source && target) acc[target] = source;
    return acc;
  }, {});

  // Auto-map when missing mapping.
  if (!sourceByTarget.publisher_name && parsedHeaders.length > 0) {
    const aliases = {
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
    for (const header of parsedHeaders) {
      const hl = String(header).toLowerCase();
      for (const [target, names] of Object.entries(aliases)) {
        if (!sourceByTarget[target] && names.includes(hl)) {
          sourceByTarget[target] = header;
        }
      }
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const row of parsedRows || []) {
    const clean = sanitizeRow(row, sourceByTarget);
    const key = clean.publisher_id || String(clean.publisher_name).toLowerCase().replace(/\s+/g, "_");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(clean);
  }

  const totalPublishers = deduped.length;
  const activePublishers = deduped.filter((p) => p.total_revenue > 0);
  const activeCount = activePublishers.length;
  const totalGMV = deduped.reduce((s, p) => s + p.total_revenue, 0);
  const activeRatio = totalPublishers > 0 ? activeCount / totalPublishers : 0;
  const gmvPerActive = activeCount > 0 ? totalGMV / activeCount : 0;

  const sorted = [...activePublishers].sort((a, b) => b.total_revenue - a.total_revenue);
  const top1GMV = sorted[0]?.total_revenue || 0;
  const top10GMV = sorted.slice(0, 10).reduce((s, p) => s + p.total_revenue, 0);
  const top1Share = totalGMV > 0 ? top1GMV / totalGMV : 0;
  const top10Share = totalGMV > 0 ? top10GMV / totalGMV : 0;

  let cumulative = 0;
  let publishersTo50 = 0;
  for (const p of sorted) {
    cumulative += p.total_revenue;
    publishersTo50 += 1;
    if (cumulative >= totalGMV * 0.5) break;
  }

  const totalApproved = deduped.reduce((s, p) => s + p.approved_revenue, 0);
  const totalPending = deduped.reduce((s, p) => s + p.pending_revenue, 0);
  const totalDeclined = deduped.reduce((s, p) => s + p.declined_revenue, 0);
  const approvalRate = totalGMV > 0 ? totalApproved / totalGMV : 0;

  const typeBuckets = {};
  activePublishers.forEach((p) => {
    const key = normTypeKey(p.publisher_type);
    if (!typeBuckets[key]) typeBuckets[key] = { type: key, count: 0, gmv: 0 };
    typeBuckets[key].count += 1;
    typeBuckets[key].gmv += p.total_revenue;
  });
  const mixRows = Object.values(typeBuckets).map((row) => ({
    ...row,
    count_share: `${activeCount > 0 ? ((row.count / activeCount) * 100).toFixed(1) : "0.0"}%`,
    gmv_share: `${totalGMV > 0 ? ((row.gmv / totalGMV) * 100).toFixed(1) : "0.0"}%`,
  }));

  clearByDataset(store, datasetId);

  pushMetric(store, datasetId, "total_publishers", totalPublishers, 0);
  pushMetric(store, datasetId, "active_publishers", activeCount, 1);
  pushMetric(store, datasetId, "active_ratio", activeRatio, 1);
  pushMetric(store, datasetId, "total_gmv", totalGMV, 0);
  pushMetric(store, datasetId, "gmv_per_active", gmvPerActive, 0);
  pushMetric(store, datasetId, "top1_share", top1Share, 2);
  pushMetric(store, datasetId, "top10_share", top10Share, 2);
  pushMetric(store, datasetId, "publishers_to_50pct", publishersTo50, 2);
  pushMetric(store, datasetId, "approval_rate", approvalRate, 5);
  pushMetric(store, datasetId, "total_approved_gmv", totalApproved, 5);
  pushMetric(store, datasetId, "total_pending_gmv", totalPending, 5);
  pushMetric(store, datasetId, "total_declined_gmv", totalDeclined, 5);

  mixRows.forEach((item) => {
    pushMetric(store, datasetId, `${item.type}_share`, totalGMV > 0 ? item.gmv / totalGMV : 0, 3);
  });

  pushTable(
    store,
    datasetId,
    "activation_publishers",
    sorted.slice(0, 100).map((p) => ({
      name: p.publisher_name,
      type: p.publisher_type,
      gmv: p.total_revenue,
      cpa: p.orders > 0 ? p.total_commission / p.orders : 0,
      approval_rate: p.total_revenue > 0 ? p.approved_revenue / p.total_revenue : 0,
    })),
    1,
  );

  let cum = 0;
  pushTable(
    store,
    datasetId,
    "topn_table",
    sorted.slice(0, 20).map((p, i) => {
      cum += p.total_revenue;
      return {
        rank: i + 1,
        name: p.publisher_name,
        gmv: `$${(p.total_revenue / 1000).toFixed(1)}K`,
        pct: `${totalGMV > 0 ? ((p.total_revenue / totalGMV) * 100).toFixed(1) : "0.0"}%`,
        cumPct: `${totalGMV > 0 ? ((cum / totalGMV) * 100).toFixed(1) : "0.0"}%`,
      };
    }),
    2,
  );

  let paretoCum = 0;
  const pace = Math.max(1, Math.ceil(sorted.length / 20));
  const pareto = [];
  sorted.forEach((p, i) => {
    paretoCum += p.total_revenue;
    if (i % pace === 0 || i === sorted.length - 1) {
      pareto.push({
        pubPct: (((i + 1) / Math.max(1, sorted.length)) * 100).toFixed(1),
        gmvPct: (totalGMV > 0 ? (paretoCum / totalGMV) * 100 : 0).toFixed(1),
      });
    }
  });
  pushTable(store, datasetId, "pareto_points", pareto, 2);

  pushTable(store, datasetId, "mix_health_table", mixRows, 3);

  pushTable(
    store,
    datasetId,
    "efficiency_scatter",
    sorted.map((p) => ({
      name: p.publisher_name,
      type: p.publisher_type,
      cpa: p.orders > 0 ? Number((p.total_commission / p.orders).toFixed(2)) : 0,
      aov: p.orders > 0 ? Number((p.total_revenue / p.orders).toFixed(2)) : 0,
      roi: p.total_commission > 0 ? Number((p.total_revenue / p.total_commission).toFixed(2)) : 0,
      gmv: p.total_revenue,
      approval_rate: p.total_revenue > 0 ? p.approved_revenue / p.total_revenue : 0,
    })),
    4,
  );

  pushTable(
    store,
    datasetId,
    "approval_table",
    sorted
      .map((p) => ({
        publisher_name: p.publisher_name,
        total_revenue: p.total_revenue,
        approved_revenue: p.approved_revenue,
        pending_revenue: p.pending_revenue,
        declined_revenue: p.declined_revenue,
        approval_rate: p.total_revenue > 0 ? p.approved_revenue / p.total_revenue : 0,
        decline_rate: p.total_revenue > 0 ? p.declined_revenue / p.total_revenue : 0,
      }))
      .sort((a, b) => b.decline_rate - a.decline_rate),
    5,
  );

  const tierBase = [...deduped].sort((a, b) => b.total_revenue - a.total_revenue);
  const tiers = tierBase.map((p, idx) => {
    let tier = "Tier 3";
    if (p.total_revenue <= 0) tier = "Tier 4";
    else if (idx < 10) tier = "Tier 1";
    else if (idx < 50) tier = "Tier 2";
    return { ...p, tier };
  });

  const tierSummary = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"].map((tier) => {
    const rows = tiers.filter((t) => t.tier === tier);
    const tierGMV = rows.reduce((s, r) => s + r.total_revenue, 0);
    return {
      tier,
      count: rows.length,
      gmv: tierGMV,
      gmv_share: totalGMV > 0 ? tierGMV / totalGMV : 0,
      top_publishers: rows
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 5)
        .map((r) => r.publisher_name),
    };
  });
  pushTable(store, datasetId, "tier_summary", tierSummary, 6);

  pushTable(store, datasetId, "timeline_tasks", [
    {
      name: `激活提升计划（目标活跃率 ${(Math.max(activeRatio, 0.4) * 100).toFixed(0)}%）`,
      month_start: 1,
      duration: 3,
      priority: activeRatio < 0.4 ? "high" : "medium",
    },
    {
      name: `去集中化计划（Top10 ${(top10Share * 100).toFixed(0)}%）`,
      month_start: 2,
      duration: 4,
      priority: top10Share > 0.5 ? "high" : "medium",
    },
    {
      name: `审批治理（Approval ${(approvalRate * 100).toFixed(0)}%）`,
      month_start: 3,
      duration: 2,
      priority: approvalRate < 0.85 ? "high" : "medium",
    },
    {
      name: "结构优化与季度复盘",
      month_start: 6,
      duration: 3,
      priority: "medium",
    },
  ], 8);

  const currentMetrics = store.MetricSnapshot.filter((m) => m.dataset_id === datasetId);
  const currentTables = store.EvidenceTable.filter((t) => t.dataset_id === datasetId);
  for (let sid = 0; sid <= 10; sid += 1) {
    pushSection(store, datasetId, sid, currentMetrics, currentTables);
  }

  dataUploads[idx] = {
    ...dataUploads[idx],
    status: "completed",
    processing_progress: 100,
    processing_step: "Completed",
    processing_completed_at: nowIso(),
    sections_ready: Array.from({ length: 11 }, (_, i) => i),
    updated_date: nowIso(),
  };

  saveStore(store);
  notify("DataUpload", "update", dataUploads[idx]);
  return { success: true, dataset_id: datasetId };
}

export function createLocalBase44Client() {
  return {
    auth: {
      async me() {
        return { id: "local-user", role: "admin", email: "local@offline" };
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
      DataUpload: buildEntityApi("DataUpload"),
      MetricSnapshot: buildEntityApi("MetricSnapshot"),
      EvidenceTable: buildEntityApi("EvidenceTable"),
      ReportSection: buildEntityApi("ReportSection"),
      ActionItem: buildEntityApi("ActionItem"),
    },
    integrations: {
      Core: {
        async UploadFile({ file }) {
          return {
            file_url: `local://${encodeURIComponent(file?.name || "upload.csv")}`,
          };
        },
      },
    },
    functions: {
      async invoke(name, payload = {}) {
        if (name === "processDataset") {
          return processDatasetLocal(payload);
        }
        if (name === "aiGenerateSections") {
          return { success: true };
        }
        if (name === "scrapeWebsite") {
          return { success: true, website: payload?.website_url || null };
        }
        return { success: true };
      },
    },
  };
}
