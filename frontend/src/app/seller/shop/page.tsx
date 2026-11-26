import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { saveShop } from '@/app/actions/seller';
import { createClient } from '@/lib/supabase/server';
import { signedR2ObjectUrl } from '@/lib/r2';

type PageProps = { searchParams: Promise<{ message?: string }> };
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function SellerShopPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect('/login');

  const [{ data: profile }, { data: shop }, { data: requests }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('shops').select('id,name,description,phone,address_text,area,offers_collection,offers_delivery,delivery_fee,status,verification_status,verification_notes,photo_path').eq('owner_id', userId).maybeSingle(),
    supabase.from('role_requests').select('status').eq('user_id', userId).eq('requested_role', 'seller').order('created_at', { ascending: false }).limit(1),
  ]);

  if (profile?.role !== 'seller') {
    const pending = requests?.[0]?.status === 'pending';
    return <main className="page-shell"><header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="text-link">My account</Link></header><section className="auth-card"><p className="eyebrow">Seller access</p><h1>{pending ? 'Your seller request is under review.' : 'Seller access is not active yet.'}</h1><p className="muted">Shop tools become available after an administrator approves your seller request. This protects the marketplace from unverified seller accounts.</p></section></main>;
  }

  const { data: shopHours } = shop
    ? await supabase.from('shop_hours').select('weekday,opens_at,closes_at,is_closed').eq('shop_id', shop.id).order('weekday')
    : { data: [] };
  const shopPhotoUrl = shop?.photo_path ? await signedR2ObjectUrl(shop.photo_path) : null;

  return (
    <main className="page-shell">
      <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="text-link">My account</Link></header>
      <section className="section-heading"><p className="eyebrow">Seller workspace</p><h1>{shop ? 'Your shop details' : 'Set up your shop'}</h1><p className="muted">Add the details buyers need to find and collect from your business.</p></section>
      {message && <p className="notice" role="status">{message}</p>}
      {shop && <section className={`shop-status-panel ${shop.status === "active" && shop.verification_status === "approved" ? "shop-status-approved" : ""}`} aria-live="polite"><div><span className="shop-status-label">Shop status</span><strong>{shop.status === "active" ? "Active" : shop.status}</strong></div><div><span className="shop-status-label">Verification</span><strong>{shop.verification_status === "approved" ? "Approved" : shop.verification_status}</strong></div><p>{shop.status === "active" && shop.verification_status === "approved" ? "Your shop is approved and active. Keep your details and opening hours up to date so nearby customers know when and where to find you." : "Your shop will appear in public search once it is approved and active."}</p>{shop.verification_notes && <p className="shop-review-note">Review note: {shop.verification_notes}</p>}</section>}
      {shopPhotoUrl && <figure className="seller-shop-photo-wrap"><Image className="seller-shop-photo" src={shopPhotoUrl} alt={shop?.name ? `${shop.name} shop` : "Shop photo"} width={960} height={480} unoptimized/><figcaption>Current shop photo</figcaption></figure>}
      <section className="auth-card auth-card-wide shop-editor">
        <form action={saveShop} className="form-stack shop-form" encType="multipart/form-data">
          <div className="shop-form-section"><h2>Basic information</h2><p>Help customers recognise your business and get in touch.</p>
            <label className="shop-field"><span>Shop name</span><input name="name" required minLength={2} maxLength={100} defaultValue={shop?.name ?? ""}/></label>
            <label className="shop-field"><span>About your shop</span><textarea name="description" rows={3} maxLength={500} defaultValue={shop?.description ?? ""}/></label>
            <label className="shop-field"><span>Shop photo <small>JPG, PNG or WebP · max 2 MB</small></span><input name="shopPhoto" type="file" accept="image/jpeg,image/png,image/webp"/></label>
          </div>
          <div className="shop-form-section"><h2>Contact and location</h2><p>Share where customers can collect their orders.</p>
            <label className="shop-field"><span>Contact phone</span><input name="phone" type="tel" maxLength={30} defaultValue={shop?.phone ?? ""} autoComplete="tel"/></label>
            <label className="shop-field"><span>Street address or collection instructions</span><input name="addressText" required minLength={4} maxLength={200} defaultValue={shop?.address_text ?? ""}/></label>
            <label className="shop-field"><span>Area / neighbourhood</span><input name="area" required minLength={2} maxLength={80} defaultValue={shop?.area ?? "Thohoyandou"}/></label>
          </div>
          <div className="shop-form-section"><h2>Order fulfilment</h2><p>Choose how customers can receive their orders.</p><fieldset className="shop-choice-fieldset"><legend>Available options</legend>
            <label className="consent-row"><input name="offersCollection" type="checkbox" defaultChecked={shop?.offers_collection ?? true}/> <span>Collection from my shop</span></label>
            <label className="consent-row"><input name="offersDelivery" type="checkbox" defaultChecked={shop?.offers_delivery ?? false}/> <span>Delivery by my shop</span></label>
          </fieldset>
          <label className="shop-field shop-fee-field"><span>Delivery fee (R)</span><input name="deliveryFee" type="number" min="0" max="99999" step="0.01" defaultValue={shop?.delivery_fee ?? 0}/></label></div>
          <fieldset className="hours-fieldset"><legend>Opening hours</legend>
            <p className="muted-small">Mark closed days. For open days, set the opening and closing times. These hours help customers plan collection.</p>
            {weekdays.map((day, weekday) => {
              const hours = shopHours?.find(item => item.weekday === weekday);
              return <div className="hours-row" key={day}>
                <strong>{day}</strong>
                <label className="consent-row shop-closed-control"><input name={`hours_${weekday}_closed`} type="checkbox" defaultChecked={hours?.is_closed ?? true}/> <span>Closed</span></label>
                <label><span>Opens</span><input name={`hours_${weekday}_open`} type="time" defaultValue={hours?.opens_at?.slice(0, 5) ?? "08:00"}/></label>
                <label><span>Closes</span><input name={`hours_${weekday}_close`} type="time" defaultValue={hours?.closes_at?.slice(0, 5) ?? "17:00"}/></label>
              </div>;
            })}
          </fieldset>
          <button className="button button-primary" type="submit">Save shop details</button>
        </form>
      </section>
      <p className="muted-small food-safety-note">Sellers are responsible for the safety and lawful handling of any food they list on SpazaLink.</p>
      {shop && <p className="form-foot"><Link href="/seller/products" className="text-link">Manage your products →</Link> · <Link href="/seller/verification" className="text-link">Verification documents →</Link></p>}
    </main>
  );
}
