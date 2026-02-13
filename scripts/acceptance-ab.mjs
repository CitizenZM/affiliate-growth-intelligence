import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const A = args[0] ? path.resolve(args[0]) : path.join(ROOT, "test-segway.csv");
const B = args[1] ? path.resolve(args[1]) : path.join(ROOT, "test-bagsmart.csv");

function parseLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += ch;
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"|"$/g, ""));
}

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.trim().split(/\r?\n/);
  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => (row[h] = vals[idx] ?? ""));
    rows.push(row);
  }
  return { headers, rows };
}

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const known = {
  publisher_id: ["publisher_id", "publisherid", "pub_id", "id"],
  publisher_name: ["publisher_name", "publishername", "name", "publisher"],
  total_revenue: ["total_revenue", "revenue", "gmv", "total_gmv", "sales"],
  total_commission: ["total_commission", "commission", "payout"],
  clicks: ["clicks", "num_clicks", "click_count"],
  orders: ["orders", "num_orders", "transactions", "conversions"],
  approved_revenue: ["approved_revenue", "approved", "approved_sales"],
  pending_revenue: ["pending_revenue", "pending"],
  declined_revenue: ["declined_revenue", "declined", "reversed_revenue"],
  publisher_type: ["publisher_type", "type", "category", "publisher_category"],
};

function autoMap(headers) {
  const map = {};
  for (const h of headers) {
    const hl = h.toLowerCase();
    for (const [target, aliases] of Object.entries(known)) {
      if (aliases.includes(hl)) {
        map[h] = target;
        break;
      }
    }
  }
  return map;
}

function compute(filePath) {
  const { headers, rows } = parseCSV(filePath);
  const map = autoMap(headers);
  const pubs = [];
  const seen = new Set();
  for (const row of rows) {
    const p = {};
    let hasName = false;
    for (const [source, target] of Object.entries(map)) {
      let val = row[source];
      if (["total_revenue", "total_commission", "clicks", "orders", "approved_revenue", "pending_revenue", "declined_revenue"].includes(target)) {
        val = toNum(val);
      }
      p[target] = val;
      if (target === "publisher_name" && val) hasName = true;
    }
    if (!hasName) continue;
    const key = p.publisher_id || String(p.publisher_name).toLowerCase().replace(/\s+/g, "_");
    if (seen.has(key)) continue;
    seen.add(key);
    pubs.push(p);
  }

  const total = pubs.length;
  const active = pubs.filter((p) => (p.total_revenue || 0) > 0);
  const totalGMV = pubs.reduce((s, p) => s + (p.total_revenue || 0), 0);
  const top = [...active].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
  const top10 = top.slice(0, 10).reduce((s, p) => s + (p.total_revenue || 0), 0);
  const approval = pubs.reduce((s, p) => s + (p.approved_revenue || 0), 0);

  return {
    file: path.basename(filePath),
    total_publishers: total,
    active_ratio: total > 0 ? active.length / total : 0,
    top10_share: totalGMV > 0 ? top10 / totalGMV : 0,
    approval_rate: totalGMV > 0 ? approval / totalGMV : 0,
    top_publisher: top[0]?.publisher_name || "N/A",
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(
    fs.existsSync(A),
    `Missing fixture: ${A}. Usage: npm run acceptance:ab -- /path/a.csv /path/b.csv`
  );
  assert(
    fs.existsSync(B),
    `Missing fixture: ${B}. Usage: npm run acceptance:ab -- /path/a.csv /path/b.csv`
  );
  const a = compute(A);
  const b = compute(B);

  console.log("A metrics:", a);
  console.log("B metrics:", b);

  assert(Math.abs(a.active_ratio - b.active_ratio) > 0.01, "active_ratio does not change between datasets");
  assert(Math.abs(a.top10_share - b.top10_share) > 0.01, "top10_share does not change between datasets");
  assert(Math.abs(a.approval_rate - b.approval_rate) > 0.01, "approval_rate does not change between datasets");
  assert(a.top_publisher !== b.top_publisher, "top publisher should differ for A/B datasets");

  const criticalPages = [
    "src/pages/Activation.jsx",
    "src/pages/Concentration.jsx",
    "src/pages/MixHealth.jsx",
    "src/pages/Efficiency.jsx",
    "src/pages/Approval.jsx",
    "src/pages/OperatingSystem.jsx",
    "src/pages/Timeline.jsx",
    "src/pages/DataCenter.jsx",
  ];

  const bannedTokens = ["const evidenceData = [", "const scatterData = [", "const tiers = [", "const tasks = ["];
  for (const page of criticalPages) {
    const content = fs.readFileSync(path.join(ROOT, page), "utf8");
    for (const token of bannedTokens) {
      assert(!content.includes(token), `${page} contains static dataset token: ${token}`);
    }
  }

  console.log("A/B acceptance checks passed.");
}

run();
