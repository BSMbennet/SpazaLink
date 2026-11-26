import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Starts the real API with dummy settings. None of these checks reach Supabase or any payment provider.
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
let server;
let output = '';

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not start:\n${output}`);
}

before(async () => {
  server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_placeholder',
      FRONTEND_ORIGIN: 'http://localhost:3000',
      TRUST_PROXY_HOPS: '1',
      PAYSTACK_SECRET_KEY: '',
      PAYSTACK_WEBHOOK_SECRET: '',
      META_APP_SECRET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  await waitForHealth();
});

after(() => {
  server?.kill();
});

test('health check answers 200', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
});

test('responses carry security headers', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('strict-transport-security'));
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('malformed JSON gets 400, not 500', async () => {
  const response = await fetch(`${base}/v1/webhooks/paystack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid request' });
});

test('a shop id that is not a UUID gets 400 before any database call', async () => {
  const response = await fetch(`${base}/v1/shops/not-a-uuid/products`);
  assert.equal(response.status, 400);
});

test('webhooks without a valid signature are refused', async () => {
  const paystack = await fetch(`${base}/v1/webhooks/paystack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'charge.success', data: { reference: 'spz123' } }),
  });
  assert.equal(paystack.status, 401);
  const meta = await fetch(`${base}/v1/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) },
    body: '{}',
  });
  assert.equal(meta.status, 401);
});

test('WhatsApp webhook verification fails without the configured token', async () => {
  const response = await fetch(`${base}/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=&hub.challenge=abc`);
  assert.equal(response.status, 403);
});

test('notification route needs a signed-in user', async () => {
  const response = await fetch(`${base}/v1/notifications/whatsapp/order`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 401);
});

test('rate limit answers 429, and a faked X-Forwarded-For cannot dodge it', async () => {
  const statuses = [];
  for (let index = 0; index < 30; index += 1) {
    const response = await fetch(`${base}/v1/notifications/whatsapp/order`, {
      method: 'POST',
      // The first value changes every time. The last one is what the trusted proxy would add.
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.8.${index}, 203.0.113.7` },
      body: '{}',
    });
    statuses.push(response.status);
  }
  assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(',')}`);
  const limited = await fetch(`${base}/v1/notifications/whatsapp/order`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.1.1.1, 203.0.113.7' },
    body: '{}',
  });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'Too many requests. Please wait a moment and try again.' });
});
