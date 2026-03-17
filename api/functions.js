import { loadDb, saveDb, uid } from "../lib/server/storage.js";
import { openAiText, openAiTranslations } from "../lib/server/openai.js";
import {
  createActionItemsFromFindings,
  generateActionItemsWithAi,
  generateReportPayload,
  generateSections,
  researchBrand,
  runDatasetWorkflow,
} from "../lib/server/workflow.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, payload = {} } = req.body || {};
    const db = await loadDb();

    if (name === "processDataset") {
      try {
        const result = await runDatasetWorkflow(db, payload, async () => {
          await saveDb(db);
        });
        return res.status(200).json({ data: result });
      } catch (error) {
        const datasetIndex = db.DataUpload.findIndex((item) => item.id === payload.dataset_id);
        if (datasetIndex !== -1) {
          db.DataUpload[datasetIndex] = {
            ...db.DataUpload[datasetIndex],
            status: "error",
            processing_step: error.message || "Processing failed",
            processing_warnings: [
              ...(db.DataUpload[datasetIndex].processing_warnings || []),
              error.message || "Processing failed",
            ],
            updated_date: new Date().toISOString(),
          };
        }
        db.Job = (db.Job || []).map((job) =>
          job.dataset_id === payload.dataset_id
            ? {
                ...job,
                status: "error",
                stage: "failed",
                updated_date: new Date().toISOString(),
              }
            : job
        );
        await saveDb(db);
        return res.status(500).json({ error: error.message });
      }
    }

    if (name === "aiGenerateSections") {
      const dataset = db.DataUpload.find((item) => item.id === payload.dataset_id);
      if (!dataset) return res.status(404).json({ error: "Dataset not found" });

      const sectionIds = payload.section_ids || dataset.sections_ready || undefined;
      db.ReportSection = db.ReportSection.filter(
        (item) => !(item.dataset_id === dataset.id && (!sectionIds || sectionIds.includes(item.section_id)))
      );
      const result = await generateSections({
        dataset,
        metrics: db.MetricSnapshot.filter((item) => item.dataset_id === dataset.id),
        evidenceTables: db.EvidenceTable.filter((item) => item.dataset_id === dataset.id),
        warnings: dataset.processing_warnings || [],
        sectionIds,
        language: payload.language || "en",
      });
      db.ReportSection.push(...result.sections);
      const datasetIndex = db.DataUpload.findIndex((item) => item.id === dataset.id);
      db.DataUpload[datasetIndex] = {
        ...db.DataUpload[datasetIndex],
        sections_ready: result.generated_sections,
        updated_date: new Date().toISOString(),
      };
      await saveDb(db);
      return res.status(200).json({ data: { success: true, ...result } });
    }

    if (name === "generateReport") {
      const dataset = db.DataUpload.find((item) => item.id === payload.dataset_id);
      if (!dataset) return res.status(404).json({ error: "Dataset not found" });
      const report = await generateReportPayload({
        dataset,
        sections: db.ReportSection.filter((item) => item.dataset_id === dataset.id),
        metrics: db.MetricSnapshot.filter((item) => item.dataset_id === dataset.id),
        format: payload.format,
      });
      return res.status(200).json(report);
    }

    if (name === "scrapeWebsite") {
      const data = await researchBrand(payload.website_url);
      return res.status(200).json({ data });
    }

    if (name === "invokeLLM") {
      if (Array.isArray(payload.translation_items) && payload.translation_items.length > 0) {
        const result = await openAiTranslations({
          items: payload.translation_items,
          targetLanguage: payload.language || "en",
        });
        return res.status(200).json(result.translations || []);
      }

      if (payload.prompt && !payload.findingsSummary && !payload.dataset_id) {
        const text = await openAiText({
          system: "You are a precise translation assistant for affiliate marketing dashboards. Return only the translated text.",
          prompt: payload.prompt,
          temperature: 0,
        });
        return res.status(200).json(text.trim());
      }

      const sections = db.ReportSection.filter((item) => item.dataset_id === payload.dataset_id);
      const findingsSummary = payload.findingsSummary || sections
        .flatMap((section) => section.key_findings || [])
        .filter((item) => item.type === "risk" || item.type === "opportunity")
        .slice(0, 12)
        .map((item, index) => ({
          index,
          type: item.type,
          title: item.title || "",
          action: item.action || "",
          trigger: item.trigger || "",
          evidence_link: item.evidence_link || item.linkPage || "",
        }));

      try {
        const items = await generateActionItemsWithAi({
          findingsSummary,
          language: payload.language || "en",
        });
        return res.status(200).json({ items });
      } catch {
        return res.status(200).json({ items: createActionItemsFromFindings(sections) });
      }
    }

    if (name === "logUserInApp") {
      const record = {
        id: uid("log"),
        pageName: payload.pageName,
        created_date: new Date().toISOString(),
      };
      db.AppLog.push(record);
      await saveDb(db);
      return res.status(200).json({ data: record });
    }

    return res.status(400).json({ error: `Unknown function: ${name}` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
