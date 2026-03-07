const API_BASE = "http://localhost:8000";

export async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const resp = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function cloneRepo(url) {
  const formData = new FormData();
  formData.append("url", url);
  const resp = await fetch(`${API_BASE}/api/clone`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function startPipeline(jobId, sourceLang = "auto") {
  const formData = new FormData();
  formData.append("job_id", jobId);
  formData.append("source_lang", sourceLang);
  const resp = await fetch(`${API_BASE}/api/start`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function getStatus(jobId) {
  const resp = await fetch(`${API_BASE}/api/status/${jobId}`);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export function getDownloadUrl(jobId) {
  return `${API_BASE}/api/download/${jobId}`;
}

export async function getReport(jobId) {
  const resp = await fetch(`${API_BASE}/api/report/${jobId}`);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function getGraphData(jobId) {
  const resp = await fetch(`${API_BASE}/api/graph/${jobId}`);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
