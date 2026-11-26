import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/server';
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect('/login');
  const [{ data: profile }, { data: roleRequests }] = await Promise.all([
    supabase.from('profiles').select('full_name,role,preferred_language').eq('id', userId).maybeSingle(),
    supabase.from('role_requests').select('requested_role,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
  ]);
  const sellerRequest = roleRequests?.find(request => request.requested_role === 'seller');
  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><form action={signOut}><button className="button button-quiet" type="submit">Sign out</button></form></header>
    <section className="welcome-panel"><p className="eyebrow">Your SpazaLink account</p><h1>Hello{profile?.full_name ? `, ${profile.full_name}` : ''}.</h1><p className="muted">Your account is ready. We are building the Thohoyandou pilot step by step.</p><div className="status-row"><span className="status-dot" /> Signed in as <strong>{profile?.role ?? 'buyer'}</strong></div></section>
    <section className="dashboard-grid">
      <article className="feature-card"><span className="feature-icon">⌕</span><h2>Find local shops</h2><p>Browse products from participating sellers near you.</p><Link href="/marketplace" className="text-link">Open marketplace →</Link></article>
      {profile?.role === 'buyer' && <article className="feature-card"><span className="feature-icon">▤</span><h2>Your orders</h2><p>View order status and cash payment confirmation.</p><Link href="/orders" className="text-link">View my orders →</Link></article>}
      <article className="feature-card"><span className="feature-icon">▣</span><h2>Seller setup</h2><p>Seller and agent accounts are activated after a review.</p>{roleRequests?.length ? <ul className="request-list">{roleRequests.map((request, index) => <li key={`${request.requested_role}-${index}`}>{request.requested_role}: <strong>{request.status}</strong></li>)}</ul> : <span className="muted-small">No seller or agent request is pending.</span>}{sellerRequest && ['pending','approved'].includes(sellerRequest.status) && <p><Link href="/seller/verification" className="text-link">Submit seller verification documents →</Link></p>}</article>
      {profile?.role === 'seller' && <article className="feature-card"><span className="feature-icon">▤</span><h2>Seller workspace</h2><p>Manage your shop details, product listings and stock.</p><Link href="/seller/shop" className="text-link">Open seller workspace →</Link><p><Link href="/seller/orders" className="text-link">Manage orders →</Link></p><p><Link href="/seller/verification" className="text-link">Verification documents →</Link></p></article>}
      {profile?.role === 'admin' && <article className="feature-card"><span className="feature-icon">✓</span><h2>Administration</h2><p>Review seller and agent applications, private documents and shop listings.</p><Link href="/admin" className="text-link">Open verification queue →</Link></article>}
    </section>
    <p className="form-foot"><Link href="/settings/notifications" className="text-link">Manage WhatsApp notifications →</Link></p>
    <p className="muted-small">Selecting seller or agent during sign-up submits a request. It does not grant permissions until reviewed by an administrator.</p>
  </main>;
}
