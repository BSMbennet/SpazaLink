import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../src/app/actions/auth.ts', import.meta.url), 'utf8');
const login = readFileSync(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8');
const forgot = readFileSync(new URL('../src/app/forgot-password/page.tsx', import.meta.url), 'utf8');
const reset = readFileSync(new URL('../src/app/reset-password/page.tsx', import.meta.url), 'utf8');
const callback = readFileSync(new URL('../src/app/auth/callback/route.ts', import.meta.url), 'utf8');

test('sign-in page provides a password reset link', () => {
  assert.match(login, /href="\/forgot-password"/);
});

test('password reset request uses Supabase recovery email and safe callback path', () => {
  assert.match(auth, /resetPasswordForEmail\(email/);
  assert.match(auth, /\/auth\/callback\?next=\/reset-password/);
  assert.match(forgot, /requestPasswordReset/);
  assert.match(forgot, /type="email"/);
});

test('password update requires a valid recovery session and enforces password length', () => {
  assert.match(auth, /getClaims\(\)/);
  assert.match(auth, /updateUser\(\{ password \}\)/);
  assert.match(auth, /password\.length < 10 \|\| password\.length > 72/);
  assert.match(reset, /updatePassword/);
});

test('auth callback validates internal redirect destinations', () => {
  assert.match(callback, /safeInternalPath\(searchParams\.get\('next'\), '\/dashboard'\)/);
});
