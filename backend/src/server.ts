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
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION;
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME;
const WHATSAPP_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en';
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;
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
  const { data: paymentOrder } = await service.from('payment_transactions').select('order_id').eq('reference', reference).maybeSingle();
  if (paymentOrder?.order_id) await notifyWhatsAppOrder(service, paymentOrder.order_id, 'Payment received');
  return reply.code(200).send({ received: true, verified: true });
});



function serviceSupabase(): SupabaseClient | null {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_GRAPH_API_VERSION) return false;
  const response = await fetch('https://graph.facebook.com/' + WHATSAPP_GRAPH_API_VERSION + '/' + WHATSAPP_PHONE_NUMBER_ID + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + WHATSAPP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    cache: 'no-store',
  });
  if (!response.ok) app.log.error({ status: response.status }, 'WhatsApp text message failed');
  return response.ok;
}

async function notifyWhatsAppOrder(service: SupabaseClient, orderId: string, eventLabel: string): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_GRAPH_API_VERSION || !WHATSAPP_TEMPLATE_NAME) return;
  const { data: order, error } = await service.from('orders')
    .select('id,order_number,buyer_id,shops!inner(owner_id)').eq('id', orderId).maybeSingle();
  if (error || !order) return;
  const relation = order.shops as unknown as { owner_id: string } | Array<{ owner_id: string }>;
  const shop = Array.isArray(relation) ? relation[0] : relation;
  if (!shop?.owner_id) return;
  const recipients = [...new Set([order.buyer_id, shop.owner_id])];
  const { data: consents } = await service.from('whatsapp_consents')
    .select('user_id,phone_e164,opted_in').in('user_id', recipients).eq('opted_in', true);
  for (const consent of consents ?? []) {
    if (!consent.phone_e164) continue;
    const isSeller = consent.user_id === shop.owner_id;
    const link = (FRONTEND_ORIGIN ?? '').replace(/[/]$/, '') + (isSeller ? '/seller/orders' : '/orders/' + order.id);
    const response = await fetch('https://graph.facebook.com/' + WHATSAPP_GRAPH_API_VERSION + '/' + WHATSAPP_PHONE_NUMBER_ID + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + WHATSAPP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: consent.phone_e164.replace(/^[+]/, ''),
        type: 'template',
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
          components: [{ type: 'body', parameters: [
            { type: 'text', text: String(order.order_number) },
            { type: 'text', text: eventLabel.slice(0, 120) },
            { type: 'text', text: link },
          ] }],
        },
      }),
      cache: 'no-store',
    });
    if (!response.ok) app.log.error({ status: response.status }, 'WhatsApp order template delivery failed');
  }
}

app.post('/v1/notifications/whatsapp/order', async (request, reply) => {
  const auth = await authenticated(request, reply);
  if (!auth) return;
  const body = request.body as { orderId?: string; event?: string };
  if (typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.orderId) ||
      typeof body.event !== 'string' || body.event.length < 2 || body.event.length > 120) {
    return reply.code(400).send({ error: 'Invalid notification request' });
  }
  const service = serviceSupabase();
  if (!service) return reply.code(503).send({ error: 'WhatsApp notifications are not configured' });
  const { data: order } = await service.from('orders')
    .select('buyer_id,shops!inner(owner_id)').eq('id', body.orderId).maybeSingle();
  if (!order) return reply.code(404).send({ error: 'Order not found' });
  const relation = order.shops as unknown as { owner_id: string } | Array<{ owner_id: string }>;
  const shop = Array.isArray(relation) ? relation[0] : relation;
  if (auth.user.id !== order.buyer_id && auth.user.id !== shop?.owner_id) {
    return reply.code(403).send({ error: 'Order participant access required' });
  }
  await notifyWhatsAppOrder(service, body.orderId, body.event);
  return reply.code(202).send({ accepted: true });
});

app.get('/v1/webhooks/whatsapp', async (request, reply) => {
  const query = request.query as Record<string, string | undefined>;
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === WHATSAPP_WEBHOOK_VERIFY_TOKEN && query['hub.challenge']) {
    return reply.type('text/plain').send(query['hub.challenge']);
  }
  return reply.code(403).send('Forbidden');
});

app.post('/v1/webhooks/whatsapp', async (request, reply) => {
  const rawBody = (request as RawBodyRequest).rawBody;
  const signature = request.headers['x-hub-signature-256'];
  if (!rawBody || typeof signature !== 'string' || !META_APP_SECRET || !/^sha256=[0-9a-f]{64}$/.test(signature)) {
    return reply.code(401).send({ error: 'Invalid Meta webhook signature' });
  }
  const expected = createHmac('sha256', META_APP_SECRET).update(rawBody).digest();
  const received = Buffer.from(signature.slice(7), 'hex');
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
    return reply.code(401).send({ error: 'Invalid Meta webhook signature' });
  }
  const service = serviceSupabase();
  if (!service) return reply.code(503).send({ error: 'WhatsApp webhook is not configured' });
  const payload = request.body as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; type?: string; text?: { body?: string } }> } }> }>;
  };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.from || message.type !== 'text') continue;
        const from = message.from.replace(/[^0-9]/g, '');
        const { data: consent } = await service.from('whatsapp_consents')
          .select('user_id,opted_in').eq('phone_e164', '+' + from).eq('opted_in', true).maybeSingle();
        if (!consent) continue;
        const text = message.text?.body?.trim() ?? '';
        const match = /^order +#?([0-9]+)$/i.exec(text);
        if (match) {
          const { data: order } = await service.from('orders')
            .select('id,order_number,status,payment_status,buyer_id,shops!inner(owner_id,name)')
            .eq('order_number', Number(match[1])).maybeSingle();
          if (order) {
            const shopRel = order.shops as unknown as { owner_id: string; name: string } | Array<{ owner_id: string; name: string }>;
            const shop = Array.isArray(shopRel) ? shopRel[0] : shopRel;
            if (order.buyer_id === consent.user_id || shop?.owner_id === consent.user_id) {
              await sendWhatsAppText(from, 'SpazaLink order #' + order.order_number + ' (' + (shop?.name ?? 'local shop') + ') is ' + order.status + '. Payment: ' + order.payment_status + '.');
              continue;
            }
          }
          await sendWhatsAppText(from, 'We could not find that order for your account. Check the order number and try again.');
        } else {
          await sendWhatsAppText(from, 'Thanks for messaging SpazaLink. To check an order, reply with ORDER followed by its number, for example ORDER 104.');
        }
      }
    }
  }
  return reply.code(200).send({ received: true });
});

app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Route not found' }));
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.code(500).send({ error: 'Unexpected server error' });
});
try { await app.listen({ port: PORT, host: HOST }); }
catch (error) { app.log.error(error); process.exit(1); }
