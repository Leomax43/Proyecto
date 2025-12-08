const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3000';

export const buildUrl = (path: string) => `${API_BASE}${path}`;

export async function apiGet(path: string) {
  const res = await fetch(buildUrl(path));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API GET ${path} failed: ${res.status} ${txt}`);
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
