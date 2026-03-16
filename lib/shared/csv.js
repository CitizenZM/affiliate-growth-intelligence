export function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase();
}

export function normalizeCellValue(value) {
  if (value == null || value === "") return null;
  return String(value).trim();
}

export function normalizeRow(row = {}) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key).trim(), normalizeCellValue(value)])
  );
}

export function parseNumeric(value) {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeFieldMapping(headers = []) {
  const knownFields = {
    publisher_id: ["publisher_id", "publisherid", "pub_id", "id"],
    publisher_name: ["publisher_name", "publishername", "name", "publisher", "partner"],
    total_revenue: ["total_revenue", "revenue", "gmv", "total_gmv", "sales"],
    total_commission: ["total_commission", "commission", "payout", "action cost", "total cost"],
    clicks: ["clicks", "num_clicks", "click_count"],
    orders: ["orders", "num_orders", "transactions", "conversions", "actions"],
    approved_revenue: ["approved_revenue", "approved", "approved_sales"],
    pending_revenue: ["pending_revenue", "pending"],
    declined_revenue: ["declined_revenue", "declined", "reversed_revenue"],
    publisher_type: ["publisher_type", "type", "category", "publisher_category"],
    aov: ["aov", "avg_order_value", "average_order_value"],
    cvr: ["cvr", "conversion_rate", "cr"],
  };

  const mapping = {};
  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (normalized === "total cost" && headers.some((item) => normalizeHeader(item) === "action cost")) {
      return;
    }
    const match = Object.entries(knownFields).find(([, values]) => values.includes(normalized));
    if (match) mapping[header] = match[0];
  });
  return mapping;
}
