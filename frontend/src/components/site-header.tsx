import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { CartLink } from '@/components/cart-link';
import { createClient } from '@/lib/supabase/server';

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let role: string | null = null;
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    role = profile?.role ?? null;
  }

  return (
    <header className="topbar site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
        <nav className="nav-actions site-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/marketplace">Marketplace</Link>
          {role === 'seller' && <Link href="/seller/shop">My shop</Link>}
          {role === 'seller' && <Link href="/seller/products">Products</Link>}
          {role === 'seller' && <Link href="/seller/orders">Orders</Link>}
          {role === 'buyer' && <Link href="/orders">My orders</Link>}
          {role === 'admin' && <Link href="/admin">Admin</Link>}
          {userId && <Link href="/settings/notifications">Notifications</Link>}
        </nav>
        <div className="nav-actions site-nav-actions">
          <CartLink />
          {userId ? (
            <>
              <Link href="/dashboard">My account</Link>
              <form action={signOut}><button className="button button-signout" type="submit">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/sign-up" className="button button-primary">Join SpazaLink</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
