const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3000';

export const buildUrl = (path: string) => `${API_BASE}${path}`;

const extractErrorMessage = (method: string, path: string, status: number, rawBody: string) => {
  if (!rawBody) {
    return `${method} ${path} failed with status ${status}`;
  }

  try {
    const payload = JSON.parse(rawBody);
    const detailedMessage = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message || payload?.error;
    if (typeof detailedMessage === 'string' && detailedMessage.trim().length > 0) {
      return detailedMessage.trim();
    }
  } catch (err) {
    // Ignore JSON parse issues and fall back to raw body below
  }

  return `${method} ${path} failed: ${status} ${rawBody}`;
};

export async function apiGet(path: string) {
  const res = await fetch(buildUrl(path));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(extractErrorMessage('GET', path, res.status, txt));
  }
  return res.json();
}

export async function apiGetOrNull(path: string) {
  try {
    return await apiGet(path);
  } catch (e) {
    return null;
  }
}

export async function apiPost<TBody extends Record<string, unknown> | Array<unknown>, TResponse = unknown>(
  path: string,
  body: TBody,
  init?: RequestInit,
) {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(extractErrorMessage('POST', path, res.status, txt));
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as TResponse) : (undefined as TResponse);
}
