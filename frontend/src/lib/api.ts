const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
export async function apiRequest<T>(path: string, accessToken?: string): Promise<T> {
  if (!API_URL) throw new Error('The API service URL is not configured.');
  const response = await fetch(`${API_URL}${path}`, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, cache: 'no-store' });
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error ?? `API request failed (${response.status})`); }
  return response.json() as Promise<T>;
}
