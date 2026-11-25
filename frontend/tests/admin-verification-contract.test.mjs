import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reviewMigration = readFileSync(new URL('../../supabase/migrations/20261125232032_phase_e_admin_seller_verification_and_role_review.sql', import.meta.url), 'utf8');
const shopGuardMigration = readFileSync(new URL('../../supabase/migrations/20261125232316_phase_e_require_approved_seller_document_for_shop.sql', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../src/app/actions/admin.ts', import.meta.url), 'utf8');
const hardeningMigration = readFileSync(new URL('../../supabase/migrations/20261125232557_phase_e_move_admin_definers_to_private_schema.sql', import.meta.url), 'utf8');

test('seller verification documents are private and RLS protected', () => {
  assert.match(reviewMigration, /alter table public\.seller_verification_documents enable row level security/i);
  assert.match(reviewMigration, /user_id = \(select auth\.uid\(\)\).*private\.has_role\('admin'/is);
  assert.match(reviewMigration, /object_path text not null unique/i);
  assert.match(reviewMigration, /grant select,insert on public\.seller_verification_documents to authenticated/i);
});

test('admin role, document and shop review implementations are moved into the private schema', () => {
  for (const fn of ['admin_review_role_request','admin_review_seller_document','admin_review_shop']) {
    const start = reviewMigration.indexOf(`function public.${fn}`);
    assert.notEqual(start, -1, `${fn} exists`);
    const end = reviewMigration.indexOf('$$;', start);
    const body = reviewMigration.slice(start, end);
    assert.match(body, /auth\.uid\(\)/i);
    assert.match(body, /private\.has_role\('admin'/i);
    assert.match(reviewMigration, new RegExp(`revoke all on function public\\.${fn}\\(.*?\\) from public,anon`, 'i'));
    assert.match(hardeningMigration, new RegExp(`alter function public\\.${fn}\\(.*?\\) set schema private`, 'i'));
    assert.match(hardeningMigration, new RegExp(`create or replace function public\\.${fn}\\(`, 'i'));

  }
  assert.match(hardeningMigration, /language sql security invoker/i);
  assert.match(hardeningMigration, /grant execute on function private\.admin_review_role_request.*to authenticated/i);
});

test('role approval changes profile role only after a pending request is locked', () => {
  assert.match(reviewMigration, /where id=p_request_id for update/i);
  assert.match(reviewMigration, /v_request\.status<>'pending'/i);
  assert.match(reviewMigration, /set role=v_request\.requested_role/i);
});

test('shop approval requires an approved seller document', () => {
  assert.match(shopGuardMigration, /d\.status='approved'/i);
  assert.match(shopGuardMigration, /SELLER_DOCUMENT_NOT_APPROVED/i);
  assert.match(shopGuardMigration, /status=v_new_status/i);
});

test('verification uploads are restricted by size and content type on the server', () => {
  assert.match(actions, /file\.size > 4 \* 1024 \* 1024/);
  assert.match(actions, /application\/pdf/);
  assert.match(actions, /image\/webp/);
  assert.match(actions, /upsert: false/);
});
