import { compareSort, loadDb, saveDb, uid } from "../lib/server/storage.js";

const allowedEntities = new Set([
  "DataUpload",
  "Publisher",
  "MetricSnapshot",
  "EvidenceTable",
  "ReportSection",
  "ActionItem",
  "Job",
  "AppLog",
]);

function sanitizeRecord(entity, record) {
  if (!record) return record;
  if (entity !== "DataUpload") return record;
  const { source_rows, ...rest } = record;
  return rest;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { entity, action, sortKey, limit = 100, query = {}, id, data = {}, patch = {} } = req.body || {};
    if (!allowedEntities.has(entity)) {
      return res.status(400).json({ error: `Unknown entity: ${entity}` });
    }

    const db = await loadDb();
    const collection = db[entity] || [];

    if (action === "list") {
      return res
        .status(200)
        .json([...collection].sort((a, b) => compareSort(sortKey, a, b)).slice(0, limit).map((item) => sanitizeRecord(entity, item)));
    }

    if (action === "filter") {
      return res.status(200).json(
        collection
          .filter((item) => Object.entries(query).every(([key, value]) => item[key] === value))
          .map((item) => sanitizeRecord(entity, item))
      );
    }

    if (action === "get") {
      const record = collection.find((item) => item.id === id);
      if (!record) return res.status(404).json({ error: `${entity} ${id} not found` });
      return res.status(200).json(sanitizeRecord(entity, record));
    }

    if (action === "create") {
      const record = {
        id: uid(entity.toLowerCase()),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        ...data,
      };
      db[entity].push(record);
      await saveDb(db);
      return res.status(200).json(sanitizeRecord(entity, record));
    }

    if (action === "update") {
      const index = collection.findIndex((item) => item.id === id);
      if (index === -1) return res.status(404).json({ error: `${entity} ${id} not found` });
      db[entity][index] = {
        ...db[entity][index],
        ...patch,
        updated_date: new Date().toISOString(),
      };
      await saveDb(db);
      return res.status(200).json(sanitizeRecord(entity, db[entity][index]));
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
