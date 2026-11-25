'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function messageUrl(path: string, message: string) {
  return `${path}?message=${encodeURIComponent(message)}`;
}

export async function signUp(formData: FormData) {
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const requestedRole = String(formData.get('role') ?? 'buyer');
  const consent = formData.get('popiaConsent') === 'on';
  if (!fullName || !email || password.length < 10 || !consent) redirect(messageUrl('/sign-up', 'Enter your details, use a password of at least 10 characters, and accept the privacy notice.'));
  if (!['buyer', 'seller', 'agent'].includes(requestedRole)) redirect(messageUrl('/sign-up', 'Choose a valid account type.'));
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { error } = await supabase.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: { full_name: fullName, phone, requested_role: requestedRole, popia_consent: true },
    },
  });
  if (error) redirect(messageUrl('/sign-up', error.message));
  redirect(messageUrl('/login', 'Account created. Check your email to confirm your address, then sign in.'));
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(messageUrl('/login', error.message));
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
