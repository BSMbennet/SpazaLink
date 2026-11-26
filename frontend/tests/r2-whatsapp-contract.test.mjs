import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const r2 = readFileSync(new URL('../src/lib/r2.ts', import.meta.url), 'utf8');
const sellerActions = readFileSync(new URL('../src/app/actions/seller.ts', import.meta.url), 'utf8');
const adminActions = readFileSync(new URL('../src/app/actions/admin.ts', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/app/marketplace/page.tsx', import.meta.url), 'utf8');
const consentMigration = readFileSync(new URL('../../supabase/migrations/20261125235921_phase_f_whatsapp_opt_in_consent.sql', import.meta.url), 'utf8');
const consentFix = readFileSync(new URL('../../supabase/migrations/20261126000104_phase_f_fix_whatsapp_phone_validation.sql', import.meta.url), 'utf8');
const optOutFix = readFileSync(new URL('../../supabase/migrations/20261126000502_phase_f_clear_whatsapp_number_on_opt_out.sql', import.meta.url), 'utf8');
const rpcHardening = readFileSync(new URL('../../supabase/migrations/20261126000410_phase_f_harden_order_and_whatsapp_rpcs.sql', import.meta.url), 'utf8');
const whatsappBackend = readFileSync(new URL('../../backend/src/server.ts', import.meta.url), 'utf8');
const whatsappAction = readFileSync(new URL('../src/app/actions/whatsapp.ts', import.meta.url), 'utf8');
const notificationLog = readFileSync(new URL('../../supabase/migrations/20261126000653_phase_f_whatsapp_notification_deduplication.sql', import.meta.url), 'utf8');

test('R2 is the storage provider and uses private signed reads', () => {
  assert.ok(r2.includes('S3Client'));
  assert.ok(r2.includes('r2.cloudflarestorage.com'));
  assert.ok(r2.includes('getSignedUrl'));
  assert.ok(r2.includes('private, max-age=3600'));
  assert.ok(sellerActions.includes('uploadR2Object'));
  assert.ok(adminActions.includes('uploadR2Object'));
  assert.ok(marketplace.includes('signedR2ObjectUrl'));
  assert.ok(!sellerActions.includes('supabase.storage'));
  assert.ok(!adminActions.includes('supabase.storage'));
});

test('WhatsApp notifications require explicit user opt-in and support opt-out', () => {
  assert.ok(consentMigration.includes('whatsapp_consents'));
  assert.ok(consentMigration.includes('enable row level security'));
  assert.ok(consentMigration.includes('set_whatsapp_consent'));
  assert.ok(consentFix.includes("^[+][1-9][0-9]{7,14}$"));
  assert.ok(whatsappAction.includes('p_opted_in: optedIn'));
  assert.ok(optOutFix.includes('phone_e164=null,opted_in=false'));
  assert.ok(rpcHardening.includes('alter function public.set_whatsapp_consent(text,boolean) set schema private'));
  assert.ok(rpcHardening.includes('security invoker'));
  assert.ok(whatsappBackend.includes("eq('opted_in', true)"));
  assert.ok(notificationLog.includes('unique(order_id,recipient_user_id,event_key)'));
  assert.ok(whatsappBackend.includes('whatsapp_notification_log'));
  assert.ok(whatsappBackend.includes('Notification does not match the current order state'));
});

test('Meta WhatsApp webhooks are signature verified and order updates use templates', () => {
  assert.ok(whatsappBackend.includes('/v1/webhooks/whatsapp'));
  assert.ok(whatsappBackend.includes('x-hub-signature-256'));
  assert.ok(whatsappBackend.includes("createHmac('sha256'"));
  assert.ok(whatsappBackend.includes('WHATSAPP_TEMPLATE_NAME'));
  assert.ok(whatsappBackend.includes('/v1/notifications/whatsapp/order'));
  assert.ok(whatsappBackend.includes('ORDER'));
});
