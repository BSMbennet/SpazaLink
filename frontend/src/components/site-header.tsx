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
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark" aria-label="SpazaLink home">Spaza<span>Link</span></Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/marketplace">Marketplace</Link>
          {role === 'seller' && <Link href="/seller/shop">My shop</Link>}
          {role === 'seller' && <Link href="/seller/products">Products</Link>}
          {role === 'seller' && <Link href="/seller/orders">Orders</Link>}
          {role === 'buyer' && <Link href="/orders">My orders</Link>}
          {role === 'admin' && <Link href="/admin">Admin</Link>}
          {userId && <Link href="/settings/notifications">Notifications</Link>}
        </nav>
        <div className="site-nav-actions">
          <CartLink />
          {userId ? (
            <>
              <Link href="/dashboard" className="site-account-link">My account</Link>
              <form action={signOut}><button className="button button-secondary site-signout" type="submit">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="site-account-link">Sign in</Link>
              <Link href="/sign-up" className="button button-primary site-signup">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
