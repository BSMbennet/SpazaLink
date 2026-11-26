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
  const isSeller = profile?.role === 'seller';

  return (
    <main className="page-shell dashboard-page">
      <header className="topbar dashboard-topbar">
        <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
        <nav className="dashboard-nav" aria-label="Main navigation">
          <Link href="/dashboard" aria-current="page">Home</Link>
          <Link href="/marketplace">Marketplace</Link>
          {isSeller && <Link href="/seller/shop">My shop</Link>}
          {isSeller && <Link href="/seller/orders">Orders</Link>}
          <Link href="/settings/notifications">Notifications</Link>
        </nav>
        <form action={signOut}>
          <button className="button button-signout" type="submit">Sign out</button>
        </form>
      </header>

      <section className="dashboard-welcome">
        <div>
          <p className="eyebrow">Your SpazaLink account</p>
          <h1>Hello{profile?.full_name ? `, ${profile.full_name}` : ''}.</h1>
          <p className="dashboard-intro">Your neighbourhood, your local shops. Everything you need to get started is right here.</p>
        </div>
        <div className="account-status">
          <span className="status-dot" />
          <span>Signed in as <strong>{profile?.role ?? 'buyer'}</strong></span>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Your account shortcuts">
        <article className="feature-card dashboard-card dashboard-card-highlight">
          <span className="feature-icon">⌕</span>
          <h2>Find local shops</h2>
          <p>Browse products from participating sellers near you.</p>
          <Link href="/marketplace" className="button button-primary">Open marketplace</Link>
        </article>

        {profile?.role === 'buyer' && (
          <article className="feature-card dashboard-card">
            <span className="feature-icon">▤</span>
            <h2>Your orders</h2>
            <p>Check order progress and cash payment confirmation.</p>
            <Link href="/orders" className="button button-secondary">View my orders</Link>
          </article>
        )}

        <article className="feature-card dashboard-card">
          <span className="feature-icon">▣</span>
          <h2>Seller setup</h2>
          <p>Seller and agent accounts are activated after an administrator review.</p>
          {roleRequests?.length ? (
            <ul className="request-list">
              {roleRequests.map((request, index) => (
                <li key={`${request.requested_role}-${index}`}>
                  <span>{request.requested_role}</span>
                  <strong className={request.status === 'approved' ? 'request-approved' : 'request-pending'}>{request.status}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="muted-small">No seller or agent request has been submitted.</p>}
          {sellerRequest && ['pending', 'approved'].includes(sellerRequest.status) && (
            <Link href="/seller/verification" className="button button-secondary">Seller verification</Link>
          )}
        </article>

        {isSeller && (
          <article className="feature-card dashboard-card dashboard-card-highlight">
            <span className="feature-icon">▤</span>
            <h2>Seller workspace</h2>
            <p>Update your shop, manage products and keep track of stock and orders.</p>
            <div className="dashboard-card-actions">
              <Link href="/seller/shop" className="button button-primary">Manage my shop</Link>
              <Link href="/seller/orders" className="button button-secondary">Manage orders</Link>
              <Link href="/seller/verification" className="button button-secondary">Verification documents</Link>
            </div>
          </article>
        )}

        {profile?.role === 'admin' && (
          <article className="feature-card dashboard-card">
            <span className="feature-icon">✓</span>
            <h2>Administration</h2>
            <p>Review seller and agent applications, private documents and shop listings.</p>
            <Link href="/admin" className="button button-primary">Open review queue</Link>
          </article>
        )}
      </section>

      <section className="dashboard-help">
        <div>
          <h2>Stay in the loop</h2>
          <p>Choose whether SpazaLink can send you order updates on WhatsApp.</p>
        </div>
        <Link href="/settings/notifications" className="button button-secondary">WhatsApp settings</Link>
      </section>

      <p className="dashboard-footnote">Choosing seller or agent during sign-up sends a request. It does not grant permissions until an administrator approves it.</p>
      <footer className="site-footer dashboard-footer">
        <span>© {new Date().getFullYear()} SpazaLink</span>
        <Link href="/privacy">Privacy notice</Link>
        <span>Rooted in Thohoyandou. Made for local trade.</span>
      </footer>
    </main>
  );
}
