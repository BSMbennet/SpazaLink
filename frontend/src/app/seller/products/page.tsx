import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addProduct, setProductActive } from '@/app/actions/seller';
import { createClient } from '@/lib/supabase/server';

type PageProps = { searchParams: Promise<{ message?: string }> };

export default async function SellerProductsPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'seller') redirect('/seller/shop?message=Seller%20approval%20is%20required.');
  const { data: shop } = await supabase.from('shops').select('id,name,status').eq('owner_id', userId).maybeSingle();
  if (!shop) redirect('/seller/shop?message=Set%20up%20your%20shop%20first.');

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('id,name,description,price,stock_quantity,is_active').eq('shop_id', shop.id).order('created_at', { ascending: false }),
    supabase.from('categories').select('id,name_en').eq('active', true).order('sort_order'),
  ]);

  return (
    <main className="page-shell">
      <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/seller/shop" className="text-link">Shop details</Link></header>
      <section className="section-heading"><p className="eyebrow">{shop.name} · Seller workspace</p><h1>Manage products</h1><p className="muted">Keep prices and stock quantities up to date.</p></section>
      {message && <p className="notice" role="status">{message}</p>}
      {shop.status !== 'active' && <p className="notice">Your shop is {shop.status}. Products can be prepared now but will not appear in the public marketplace until the shop is approved.</p>}
      <section className="auth-card auth-card-wide">
        <h2>Add a product</h2>
        <form action={addProduct} className="form-stack">
          <label>Product name<input name="name" required minLength={2} maxLength={120}/></label>
          <label>Description<input name="description" maxLength={500}/></label>
          <label>Category<select name="categoryId" defaultValue=""><option value="">Other / not specified</option>{(categories ?? []).map(category => <option key={category.id} value={category.id}>{category.name_en}</option>)}</select></label>
          <div className="form-grid">
            <label>Price (R)<input name="price" type="number" min="0" max="99999999.99" step="0.01" required/></label>
            <label>Stock quantity<input name="stockQuantity" type="number" min="0" max="1000000" step="1" defaultValue="0" required/></label>
          </div>
          <button className="button button-primary" type="submit">Add product</button>
        </form>
      </section>
      <section className="dashboard-grid">
        {(products ?? []).map(product => <article className="feature-card" key={product.id}>
          <p className="eyebrow">{product.is_active ? 'Listed' : 'Hidden'}</p><h2>{product.name}</h2>
          {product.description && <p>{product.description}</p>}
          <p className="price">R {Number(product.price).toFixed(2)}</p><p className="muted-small">{product.stock_quantity} in stock</p>
          <form action={setProductActive}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="active" value={product.is_active ? 'false' : 'true'}/><button className="button button-secondary" type="submit">{product.is_active ? 'Hide product' : 'List product'}</button></form>
        </article>)}
        {!products?.length && <p className="empty-state">Your product catalogue is empty. Add your first product above.</p>}
      </section>
    </main>
  );
}
