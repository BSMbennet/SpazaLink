import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');

test('API exposes a health endpoint for Render checks', () => {
  assert.match(server, /app\.get\('\/health'/);
});
test('authenticated API validates the Supabase access token', () => {
  assert.match(server, /Authorization: `Bearer \$\{token\}`/);
  assert.match(server, /client\.auth\.getUser\(token\)/);
});
test('public catalog routes read only active shops and products', () => {
  assert.match(server, /\.eq\('status', 'active'\)/);
  assert.match(server, /\.eq\('is_active', true\)/);
});
