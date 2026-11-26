// Only allow redirects to a path on this site. This stops "open redirect" tricks such as
// "//evil.com", "/\evil.com" or "https://evil.com" in a ?next= link.
export function safeInternalPath(candidate: string | null | undefined, fallback = '/dashboard'): string {
  if (!candidate || candidate.length > 200) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  try {
    const base = 'http://internal.invalid';
    const url = new URL(candidate, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
