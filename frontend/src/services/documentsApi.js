const API_BASE = '/api';

async function getErrorMessage(response) {
  try {
    const body = await response.json();
    return body.error?.message || `A solicitação falhou (${response.status}).`;
  } catch {
    return `A solicitação falhou (${response.status}).`;
  }
}

async function ensureSuccess(response) {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response;
}

export async function listDocuments(owner, { signal } = {}) {
  const response = await fetch(`${API_BASE}/documents?limit=100&offset=0`, {
    headers: { 'X-User-Id': owner },
    signal,
  });
  const body = await ensureSuccess(response);
  const result = await body.json();
  return result.documents;
}

export async function uploadDocument(file, owner) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': owner },
    body: formData,
  });
  const body = await ensureSuccess(response);
  const result = await body.json();
  return result.document;
}

export async function downloadDocument(document, owner) {
  const response = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(document.id)}/download`,
    { headers: { 'X-User-Id': owner } }
  );
  const body = await ensureSuccess(response);
  const objectUrl = URL.createObjectURL(await body.blob());
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = document.originalName;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}