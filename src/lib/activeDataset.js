const ACTIVE_DATASET_KEY = "active-dataset-id";

export function getActiveDatasetId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_DATASET_KEY);
}

export function setActiveDatasetId(datasetId) {
  if (typeof window === "undefined" || !datasetId) return;
  window.localStorage.setItem(ACTIVE_DATASET_KEY, datasetId);
}

export function clearActiveDatasetId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_DATASET_KEY);
}
