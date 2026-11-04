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

function createHeaders(owner, token) {
  const headers = { 'X-User-Id': owner };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function listDocuments(owner, { signal, token, limit = 50, offset = 0 } = {}) {
  const response = await fetch(`${API_BASE}/documents?limit=${limit}&offset=${offset}`, {
    headers: createHeaders(owner, token),
    signal,
  });
  const body = await ensureSuccess(response);
  return body.json();
}

export async function uploadDocument(file, owner, token) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: createHeaders(owner, token),
    body: formData,
  });
  const body = await ensureSuccess(response);
  const result = await body.json();
  return result.document;
}

export async function downloadDocument(document, owner, token) {
  const response = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(document.id)}/download`,
    { headers: createHeaders(owner, token) }
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