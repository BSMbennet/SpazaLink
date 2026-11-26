import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sniffFileType } from '../src/lib/uploads.ts';
import { safeInternalPath } from '../src/lib/safe-redirect.ts';

const nextConfig = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
const authActions = readFileSync(new URL('../src/app/actions/auth.ts', import.meta.url), 'utf8');
const r2 = readFileSync(new URL('../src/lib/r2.ts', import.meta.url), 'utf8');

const bytes = (...values) => Uint8Array.from(values);
const ascii = (text) => [...text].map((char) => char.charCodeAt(0));

test('upload check recognises real JPEG, PNG, WebP and PDF files by their first bytes', () => {
  assert.equal(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), 'image/jpeg');
  assert.equal(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), 'image/png');
  assert.equal(sniffFileType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP'), 0)), 'image/webp');
  assert.equal(sniffFileType(bytes(...ascii('%PDF-1.7'))), 'application/pdf');
});

test('upload check rejects scripts, HTML, SVG and empty or tiny files pretending to be images', () => {
  assert.equal(sniffFileType(bytes(...ascii('<script>alert(1)</script>'))), null);
  assert.equal(sniffFileType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))), null);
  assert.equal(sniffFileType(bytes(...ascii('<!doctype html>'))), null);
  assert.equal(sniffFileType(bytes()), null);
  assert.equal(sniffFileType(bytes(0xff, 0xd8)), null);
  assert.equal(sniffFileType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE'))), null);
});

test('R2 upload compares file content with the claimed type and stores the detected type', () => {
  assert.ok(r2.includes('sniffFileType'));
  assert.ok(r2.includes('detected !== file.type'));
  assert.ok(r2.includes('ContentType: contentType'));
  assert.ok(r2.includes('optimiseImage'));
  assert.ok(r2.includes('private, max-age=3600'));
});

test('redirect helper allows only paths on this site', () => {
  assert.equal(safeInternalPath('/dashboard'), '/dashboard');
  assert.equal(safeInternalPath('/orders/abc?x=1#top'), '/orders/abc?x=1#top');
  for (const bad of ['//evil.com', '/\\evil.com', '\\\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/a\r\nSet-Cookie:x', '/a\nb', '', null, undefined, '/' + 'a'.repeat(300)]) {
    assert.equal(safeInternalPath(bad), '/dashboard', `should reject ${String(bad).slice(0, 30)}`);
  }
  assert.equal(safeInternalPath('//evil.com', '/home'), '/home');
  // Percent-encoded characters stay encoded, so they remain an inert path on this site.
  assert.equal(safeInternalPath('/%0d%0aSet-Cookie:x'), '/%0d%0aSet-Cookie:x');
});

test('email confirmation callback uses the redirect helper', () => {
  const callback = readFileSync(new URL('../src/app/auth/callback/route.ts', import.meta.url), 'utf8');
  assert.ok(callback.includes('safeInternalPath'));
});

test('sign in and sign up never show the raw provider error', () => {
  assert.ok(!/messageUrl\([^)]*error\.message/.test(authActions));
  assert.ok(authActions.includes('Email or password is not correct'));
});

test('security headers are set for every page', () => {
  for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(nextConfig.includes(header), `missing ${header}`);
  }
  for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
    assert.ok(nextConfig.includes(directive), `missing ${directive}`);
  }
  assert.ok(!nextConfig.includes("script-src 'self' 'unsafe-inline' 'unsafe-eval'"));
});
