const BUCKET = "affiliate-growth-intelligence";
const DB_PATH = "app-state/db.json";

const defaultDb = {
  DataUpload: [],
  Publisher: [],
  PublisherTypeCache: [],
  MetricSnapshot: [],
  EvidenceTable: [],
  ReportSection: [],
  ActionItem: [],
  Job: [],
  AppLog: [],
  BrandResearchCache: [],
};

let bucketPromise = null;

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getHeaders(extra = {}) {
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function getUrl(path) {
  return `${getEnv("SUPABASE_URL")}${path}`;
}

async function ensureBucket() {
  if (!bucketPromise) {
    bucketPromise = (async () => {
      const listResponse = await fetch(getUrl("/storage/v1/bucket"), {
        headers: getHeaders(),
      });
      if (!listResponse.ok) {
        throw new Error(`Unable to list Supabase buckets (${listResponse.status})`);
      }
      const buckets = await listResponse.json();
      if (buckets.some((bucket) => bucket.name === BUCKET || bucket.id === BUCKET)) return;
      const createResponse = await fetch(getUrl("/storage/v1/bucket"), {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
      });
      if (!createResponse.ok) {
        const message = await createResponse.text();
        throw new Error(`Unable to create Supabase bucket (${createResponse.status}): ${message}`);
      }
    })();
  }
  return bucketPromise;
}

async function readObject(path) {
  await ensureBucket();
  const response = await fetch(getUrl(`/storage/v1/object/${BUCKET}/${path}`), {
    headers: getHeaders(),
  });

  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Unable to read ${path} from Supabase Storage (${response.status})`);
  }
  return response.text();
}

async function writeObject(path, content, contentType = "application/json") {
  await ensureBucket();
  const response = await fetch(getUrl(`/storage/v1/object/${BUCKET}/${path}`), {
    method: "POST",
    headers: getHeaders({
      "Content-Type": contentType,
      "x-upsert": "true",
    }),
    body: content,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Unable to write ${path} to Supabase Storage (${response.status}): ${message}`);
  }
}

export async function loadDb() {
  const raw = await readObject(DB_PATH);
  if (!raw) return structuredClone(defaultDb);
  try {
    return { ...structuredClone(defaultDb), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultDb);
  }
}

export async function saveDb(db) {
  await writeObject(DB_PATH, JSON.stringify(db), "application/json");
}

export async function withDb(mutator) {
  const db = await loadDb();
  const result = await mutator(db);
  db.updated_at = new Date().toISOString();
  await saveDb(db);
  return result;
}

export function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function compareSort(sortKey, a, b) {
  if (!sortKey) return 0;
  const direction = sortKey.startsWith("-") ? -1 : 1;
  const key = sortKey.replace(/^-/, "");
  const aVal = a[key] ?? "";
  const bVal = b[key] ?? "";
  if (aVal < bVal) return -1 * direction;
  if (aVal > bVal) return 1 * direction;
  return 0;
}
