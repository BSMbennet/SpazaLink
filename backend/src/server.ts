import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT ?? 10000);
const HOST = process.env.HOST ?? '0.0.0.0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 1_048_576 });
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
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
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
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
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
app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Route not found' }));
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.code(500).send({ error: 'Unexpected server error' });
});
try { await app.listen({ port: PORT, host: HOST }); }
catch (error) { app.log.error(error); process.exit(1); }
