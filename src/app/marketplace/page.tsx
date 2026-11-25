import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
export default async function MarketplacePage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase.from('products')
    .select('id,name,description,price,stock_quantity,photo_path,shops!inner(id,name,area,status)')
    .eq('is_active', true).eq('shops.status', 'active').gt('stock_quantity', 0)
    .order('created_at', { ascending: false }).limit(40);
  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="button button-quiet">My account</Link></header>
    <section className="section-heading"><p className="eyebrow">Thohoyandou pilot</p><h1>Shop close to home.</h1><p className="muted">Local products from participating neighbourhood sellers.</p></section>
    {error ? <p className="notice">The marketplace could not load right now. Please try again.</p> : products?.length ? <div className="product-grid">{products.map((product) => {
      const shop = Array.isArray(product.shops) ? product.shops[0] : product.shops;
      return <article className="product-card" key={product.id}><div className="product-placeholder">{product.name.slice(0, 1).toUpperCase()}</div><div className="product-content"><p className="muted-small">{shop?.name} · {shop?.area}</p><h2>{product.name}</h2><p className="price">R {Number(product.price).toFixed(2)}</p><p className="muted-small">{product.stock_quantity} available</p></div></article>;
    })}</div> : <div className="empty-state"><span className="feature-icon">⌕</span><h2>Your local marketplace is getting ready.</h2><p>No active products are listed yet. When pilot sellers publish their products, you will see them here.</p></div>}
  </main>;
}
