import { base44 } from "@/api/base44Client";
import { isSupabaseEnabled, supabase } from "@/lib/supabaseClient";

const safeUpsert = async (table, rows, onConflict) => {
  if (!isSupabaseEnabled || !supabase || !rows || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.warn(`[supabase] upsert failed for ${table}:`, error.message);
  }
};

export async function syncDatasetRun(dataset) {
  if (!dataset || !dataset.id) return;
  await safeUpsert(
    "dataset_runs",
    [
      {
        dataset_id: dataset.id,
        file_name: dataset.file_name || null,
        version_label: dataset.version_label || null,
        status: dataset.status || "pending",
        processing_progress: dataset.processing_progress ?? 0,
        processing_step: dataset.processing_step || null,
        sections_ready: dataset.sections_ready || [],
        updated_at: new Date().toISOString(),
      },
    ],
    "dataset_id"
  );
}

export async function syncAnalysisSnapshot(datasetId, metrics = [], evidenceTables = [], sections = []) {
  if (!datasetId) return;

  const metricRows = metrics.map((m) => ({
    dataset_id: datasetId,
    metric_key: m.metric_key,
    value_num: m.value_num ?? 0,
    module_id: m.module_id ?? null,
    calc_version: m.calc_version || null,
    updated_at: new Date().toISOString(),
  }));
  await safeUpsert("analysis_metrics", metricRows, "dataset_id,metric_key");

  const evidenceRows = evidenceTables.map((t) => ({
    dataset_id: datasetId,
    table_key: t.table_key,
    data_json: t.data_json ?? [],
    module_id: t.module_id ?? null,
    row_count: t.row_count ?? null,
    updated_at: new Date().toISOString(),
  }));
  await safeUpsert("analysis_evidence_tables", evidenceRows, "dataset_id,table_key");

  const sectionRows = sections.map((s) => ({
    dataset_id: datasetId,
    section_id: s.section_id,
    title: s.title || null,
    conclusion: s.conclusion || null,
    conclusion_status: s.conclusion_status || null,
    content_md: s.content_md || null,
    key_findings: s.key_findings || [],
    derivation_notes: s.derivation_notes || [],
    ai_generated: Boolean(s.ai_generated),
    updated_at: new Date().toISOString(),
  }));
  await safeUpsert("analysis_sections", sectionRows, "dataset_id,section_id");
}

export async function listDatasetsForSelector() {
  if (!isSupabaseEnabled || !supabase) {
    return base44.entities.DataUpload.list("-created_date", 50);
  }

  const { data, error } = await supabase
    .from("dataset_runs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[supabase] dataset_runs select failed, fallback to Base44:", error.message);
    return base44.entities.DataUpload.list("-created_date", 50);
  }

  return (data || []).map((row) => ({
    id: row.dataset_id,
    file_name: row.file_name,
    version_label: row.version_label,
    status: row.status,
    processing_progress: row.processing_progress,
    processing_step: row.processing_step,
    sections_ready: row.sections_ready || [],
    updated_date: row.updated_at,
  }));
}

