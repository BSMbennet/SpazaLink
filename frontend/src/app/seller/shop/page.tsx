import Link from 'next/link';
import { redirect } from 'next/navigation';
import { saveShop } from '@/app/actions/seller';
import { createClient } from '@/lib/supabase/server';

type PageProps = { searchParams: Promise<{ message?: string }> };

export default async function SellerShopPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect('/login');

  const [{ data: profile }, { data: shop }, { data: requests }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('shops').select('id,name,description,phone,address_text,area,offers_collection,offers_delivery,delivery_fee,status').eq('owner_id', userId).maybeSingle(),
    supabase.from('role_requests').select('status').eq('user_id', userId).eq('requested_role', 'seller').order('created_at', { ascending: false }).limit(1),
  ]);

  if (profile?.role !== 'seller') {
    const pending = requests?.[0]?.status === 'pending';
    return <main className="page-shell"><header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="text-link">My account</Link></header><section className="auth-card"><p className="eyebrow">Seller access</p><h1>{pending ? 'Your seller request is under review.' : 'Seller access is not active yet.'}</h1><p className="muted">Shop tools become available after an administrator approves your seller request. This protects the marketplace from unverified seller accounts.</p></section></main>;
  }

  return (
    <main className="page-shell">
      <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="text-link">My account</Link></header>
      <section className="section-heading"><p className="eyebrow">Seller workspace</p><h1>{shop ? 'Your shop details' : 'Set up your shop'}</h1><p className="muted">Add the details buyers need to find and collect from your business.</p></section>
      {message && <p className="notice" role="status">{message}</p>}
      {shop && <p className="notice">Shop status: <strong>{shop.status}</strong>. New shops are reviewed before appearing in public search.</p>}
      <section className="auth-card auth-card-wide">
        <form action={saveShop} className="form-stack">
          <label>Shop name<input name="name" required minLength={2} maxLength={100} defaultValue={shop?.name ?? ''}/></label>
          <label>About your shop<textarea name="description" rows={3} maxLength={500} defaultValue={shop?.description ?? ''}/></label>
          <label>Contact phone<input name="phone" type="tel" maxLength={30} defaultValue={shop?.phone ?? ''}/></label>
          <label>Street address or collection instructions<input name="addressText" required minLength={4} maxLength={200} defaultValue={shop?.address_text ?? ''}/></label>
          <label>Area / neighbourhood<input name="area" required minLength={2} maxLength={80} defaultValue={shop?.area ?? 'Thohoyandou'}/></label>
          <fieldset><legend>How can customers receive orders?</legend>
            <label className="consent-row"><input name="offersCollection" type="checkbox" defaultChecked={shop?.offers_collection ?? true}/> Collection from my shop</label>
            <label className="consent-row"><input name="offersDelivery" type="checkbox" defaultChecked={shop?.offers_delivery ?? false}/> Delivery by my shop</label>
          </fieldset>
          <label>Delivery fee (R)<input name="deliveryFee" type="number" min="0" max="99999" step="0.01" defaultValue={shop?.delivery_fee ?? 0}/></label>
          <button className="button button-primary" type="submit">Save shop details</button>
        </form>
      </section>
      {shop && <p className="form-foot"><Link href="/seller/products" className="text-link">Manage your products →</Link></p>}
    </main>
  );
}
