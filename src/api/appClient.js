async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

const subscribers = {
  DataUpload: new Set(),
  Publisher: new Set(),
  MetricSnapshot: new Set(),
  EvidenceTable: new Set(),
  ReportSection: new Set(),
  ActionItem: new Set(),
  Job: new Set(),
  AppLog: new Set(),
};

function notify(entity, type, record) {
  subscribers[entity]?.forEach((callback) => {
    try {
      callback({ type, id: record?.id, data: record });
    } catch {
      // Ignore subscriber errors.
    }
  });
}

function collectionApi(entity) {
  return {
    async list(sortKey, limit = 100) {
      return postJson("/api/entities", { entity, action: "list", sortKey, limit });
    },
    async filter(query = {}) {
      return postJson("/api/entities", { entity, action: "filter", query });
    },
    async get(id) {
      return postJson("/api/entities", { entity, action: "get", id });
    },
    async create(data) {
      const record = await postJson("/api/entities", { entity, action: "create", data });
      notify(entity, "create", record);
      return record;
    },
    async update(id, patch) {
      const record = await postJson("/api/entities", { entity, action: "update", id, patch });
      notify(entity, "update", record);
      return record;
    },
    subscribe(callback) {
      subscribers[entity].add(callback);
      return () => subscribers[entity].delete(callback);
    },
  };
}

export const appClient = {
  entities: {
    DataUpload: collectionApi("DataUpload"),
    Publisher: collectionApi("Publisher"),
    MetricSnapshot: collectionApi("MetricSnapshot"),
    EvidenceTable: collectionApi("EvidenceTable"),
    ReportSection: collectionApi("ReportSection"),
    ActionItem: collectionApi("ActionItem"),
    Job: collectionApi("Job"),
    AppLog: collectionApi("AppLog"),
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        return { file_url: `browser://${file?.name || "dataset"}` };
      },
      async InvokeLLM({ prompt, response_json_schema, dataset_id, language, findingsSummary, translation_items }) {
        if (prompt?.startsWith("Translate this Chinese")) {
          return prompt.match(/"(.+)"$/)?.[1] || prompt;
        }
        return postJson("/api/functions", {
          name: "invokeLLM",
          payload: { prompt, response_json_schema, dataset_id, language, findingsSummary, translation_items },
        });
      },
    },
  },
  functions: {
    async invoke(name, payload) {
      const response = await postJson("/api/functions", { name, payload });
      [
        "DataUpload",
        "Publisher",
        "MetricSnapshot",
        "EvidenceTable",
        "ReportSection",
        "ActionItem",
      ].forEach((entity) => notify(entity, "refresh", { id: payload?.dataset_id }));
      return response;
    },
  },
  auth: {
    async me() {
      return { id: "local-user", name: "Workspace User", role: "admin" };
    },
    logout() {},
    redirectToLogin() {},
  },
  appLogs: {
    async logUserInApp(pageName) {
      const response = await postJson("/api/functions", { name: "logUserInApp", payload: { pageName } });
      return response.data;
    },
  },
};
