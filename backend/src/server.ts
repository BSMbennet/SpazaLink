import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT ?? 10000);
const HOST = process.env.HOST ?? '0.0.0.0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 1_048_576 });
interface RawBodyRequest extends FastifyRequest { rawBody?: Buffer; }
app.removeContentTypeParser('application/json');
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
  const raw = body as Buffer;
  (request as RawBodyRequest).rawBody = raw;
  try { done(null, JSON.parse(raw.toString('utf8'))); }
  catch (error) { done(error as Error); }
});
await app.register(helmet);
await app.register(cors, {
  origin: FRONTEND_ORIGIN ? [FRONTEND_ORIGIN] : false,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

function bearer(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}
function scopedClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
async function authenticated(request: FastifyRequest, reply: FastifyReply) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ error: 'Authentication required' }); return null; }
  const client = scopedClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) { await reply.code(401).send({ error: 'Invalid or expired session' }); return null; }
  return { client, user: data.user };
}
function publicClient() {
  return createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

app.get('/health', async () => ({ status: 'ok', service: 'spazalink-api' }));
app.get('/v1/me', async (request, reply) => {
  const auth = await authenticated(request, reply);
  if (!auth) return;
  const { data, error } = await auth.client.from('profiles')
    .select('id, role, full_name, phone, preferred_language').eq('id', auth.user.id).maybeSingle();
  if (error) return reply.code(500).send({ error: 'Could not load profile' });
  return { user: auth.user, profile: data };
});
app.get('/v1/shops', async (request, reply) => {
  const query = request.query as { area?: string; search?: string };
  let builder = publicClient().from('shops')
    .select('id, name, description, photo_path, phone, address_text, area, offers_collection, offers_delivery, delivery_fee, verified_at')
    .eq('status', 'active').order('name').limit(50);
  if (query.area) builder = builder.ilike('area', `%${query.area.slice(0, 80)}%`);
  if (query.search) builder = builder.ilike('name', `%${query.search.slice(0, 80)}%`);
  const { data, error } = await builder;
  if (error) return reply.code(500).send({ error: 'Could not load shops' });
  return { shops: data ?? [] };
});
app.get('/v1/shops/:shopId/products', async (request, reply) => {
  const { shopId } = request.params as { shopId: string };
  const { data, error } = await publicClient().from('products')
    .select('id, shop_id, category_id, name, description, photo_path, price, stock_quantity')
    .eq('shop_id', shopId).eq('is_active', true).gt('stock_quantity', 0).order('name').limit(100);
  if (error) return reply.code(500).send({ error: 'Could not load products' });
  return { products: data ?? [] };
});


function validPaystackSignature(rawBody: Buffer, request: FastifyRequest): boolean {
  const modern = request.headers['paystack-signature'];
  if (typeof modern === 'string') {
    if (!PAYSTACK_WEBHOOK_SECRET) return false;
    const fields = modern.split(',').map(value => value.trim());
    const timestamp = fields.find(value => value.startsWith('t='))?.slice(2);
    const signedAt = Number(timestamp);
    if (!timestamp || !Number.isFinite(signedAt) || Math.abs(Date.now() / 1000 - signedAt) > 300) return false;
    const expected = createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
      .update(timestamp + '.').update(rawBody).digest();
    return fields.filter(value => value.startsWith('v1=')).some(value => {
      const pair = value.slice(3).split(':');
      const receivedHex = pair[pair.length - 1] ?? '';
      if (!/^[0-9a-f]{128}$/.test(receivedHex)) return false;
      const received = Buffer.from(receivedHex, 'hex');
      return received.length === expected.length && timingSafeEqual(expected, received);
    });
  }
  const legacy = request.headers['x-paystack-signature'];
  if (typeof legacy !== 'string' || !PAYSTACK_SECRET_KEY || !/^[0-9a-f]{128}$/.test(legacy)) return false;
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest();
  const received = Buffer.from(legacy, 'hex');
  return received.length === expected.length && timingSafeEqual(expected, received);
}

app.post('/v1/webhooks/paystack', async (request, reply) => {
  const rawBody = (request as RawBodyRequest).rawBody;
  if (!rawBody || !validPaystackSignature(rawBody, request)) {
    return reply.code(401).send({ error: 'Invalid Paystack signature' });
  }
  if (!PAYSTACK_SECRET_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    request.log.error('Paystack webhook received but payment verification secrets are not configured');
    return reply.code(503).send({ error: 'Payment verification is not configured' });
  }

  const event = request.body as { event?: string; data?: { reference?: string } };
  if (event.event !== 'charge.success' || typeof event.data?.reference !== 'string') {
    return reply.code(200).send({ received: true });
  }

  const reference = event.data.reference;
  const verification = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
    headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET_KEY },
    cache: 'no-store',
  });
  if (!verification.ok) {
    request.log.error({ reference, status: verification.status }, 'Paystack verification request failed');
    return reply.code(502).send({ error: 'Could not verify payment with provider' });
  }
  const result = await verification.json() as {
    status?: boolean;
    data?: { status?: string; reference?: string; amount?: number; currency?: string; id?: number | string };
  };
  const payment = result.data;
  if (!result.status || payment?.status !== 'success' || payment.reference !== reference ||
      !Number.isSafeInteger(payment.amount) || typeof payment.currency !== 'string') {
    return reply.code(200).send({ received: true, verified: false });
  }

  const service = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await service.rpc('finalize_paystack_payment', {
    p_reference: reference,
    p_amount_minor: payment.amount,
    p_currency: payment.currency,
    p_provider_transaction_id: String(payment.id ?? ''),
  });
  if (error || data !== true) {
    request.log.error({ reference, error }, 'Verified Paystack payment did not match an order');
    return reply.code(422).send({ error: 'Payment could not be matched to an order' });
  }
  return reply.code(200).send({ received: true, verified: true });
});

app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Route not found' }));
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.code(500).send({ error: 'Unexpected server error' });
});
try { await app.listen({ port: PORT, host: HOST }); }
catch (error) { app.log.error(error); process.exit(1); }
