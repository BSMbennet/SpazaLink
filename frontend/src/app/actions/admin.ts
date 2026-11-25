'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'admin') redirect('/dashboard');
  return supabase;
}

function reviewInput(formData: FormData, idField: string, decisions: string[]) {
  const id = String(formData.get(idField) ?? '');
  const decision = String(formData.get('decision') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  if (!uuidPattern.test(id) || !decisions.includes(decision) || notes.length > 500) {
    redirect('/admin?notice=invalid');
  }
  return { id, decision, notes: notes || null };
}

async function runReview(rpc: string, args: Record<string, unknown>) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc(rpc, args);
  if (error) redirect('/admin?notice=failed');
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/seller/shop');
  revalidatePath('/seller/verification');
  redirect('/admin?notice=updated');
}

export async function reviewRoleRequest(formData: FormData) {
  const { id, decision, notes } = reviewInput(formData, 'requestId', ['approve', 'reject']);
  await runReview('admin_review_role_request', { p_request_id: id, p_decision: decision, p_notes: notes });
}

export async function reviewSellerDocument(formData: FormData) {
  const { id, decision, notes } = reviewInput(formData, 'documentId', ['approve', 'reject']);
  await runReview('admin_review_seller_document', { p_document_id: id, p_decision: decision, p_notes: notes });
}

export async function reviewShop(formData: FormData) {
  const { id, decision, notes } = reviewInput(formData, 'shopId', ['approve', 'reject', 'suspend']);
  await runReview('admin_review_shop', { p_shop_id: id, p_decision: decision, p_notes: notes });
}

export async function submitSellerVerificationDocument(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');

  const [{ data: profile }, { data: request }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('role_requests').select('id').eq('user_id', userId).eq('requested_role', 'seller').in('status', ['pending','approved']).limit(1).maybeSingle(),
  ]);
  if (profile?.role !== 'seller' && !request) redirect('/dashboard');

  const documentType = String(formData.get('documentType') ?? '');
  const file = formData.get('document');
  const types: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  if (!['identity', 'business', 'food_handling', 'other'].includes(documentType) ||
      !(file instanceof File) || file.size < 1 || file.size > 4 * 1024 * 1024 ||
      !types[file.type]) {
    redirect('/seller/verification?message=invalid');
  }

  const path = `${userId}/verification/${randomUUID()}.${types[file.type]}`;
  const { error: uploadError } = await supabase.storage.from('seller-verification').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) redirect('/seller/verification?message=upload-failed');

  const { error: insertError } = await supabase.from('seller_verification_documents').insert({
    user_id: userId,
    document_type: documentType,
    object_path: path,
  });
  if (insertError) {
    await supabase.storage.from('seller-verification').remove([path]);
    redirect('/seller/verification?message=save-failed');
  }
  revalidatePath('/seller/verification');
  redirect('/seller/verification?message=uploaded');
}
