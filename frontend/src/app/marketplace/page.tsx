import Link from 'next/link';
import Image from 'next/image';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { CartLink } from '@/components/cart-link';
import { createClient } from '@/lib/supabase/server';
import { signedR2ObjectUrl } from '@/lib/r2';

type PageProps = {
  searchParams: Promise<{ search?: string; area?: string; category?: string }>;
};

export default async function MarketplacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? '').trim().replace(/[,%()]/g, ' ').slice(0, 80);
  const area = (params.area ?? '').trim().replace(/[,%()]/g, ' ').slice(0, 80);
  const categoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.category ?? '')
    ? params.category!
    : '';
  const supabase = await createClient();
  let productsQuery = supabase.from('products')
    .select('id,name,description,price,stock_quantity,photo_path,category_id,shops!inner(id,name,area,status,photo_path,offers_collection,offers_delivery,delivery_fee)')
    .eq('is_active', true).eq('shops.status', 'active').gt('stock_quantity', 0)
    .order('created_at', { ascending: false }).limit(60);
  if (search) productsQuery = productsQuery.ilike('name', `%${search}%`);
  if (area) productsQuery = productsQuery.ilike('shops.area', `%${area}%`);
  if (categoryId) productsQuery = productsQuery.eq('category_id', categoryId);
  const [{ data: products, error }, { data: categories }] = await Promise.all([
    productsQuery,
    supabase.from('categories').select('id,name_en').eq('active', true).order('sort_order'),
  ]);

  const productsWithPhotos = await Promise.all((products ?? []).map(async product => {
    const shop = Array.isArray(product.shops) ? product.shops[0] : product.shops;
    return {
      ...product,
      shop,
      photoUrl: product.photo_path ? await signedR2ObjectUrl(product.photo_path) : null,
      shopPhotoUrl: shop?.photo_path ? await signedR2ObjectUrl(shop.photo_path) : null,
    };
  }));

  const hasFilters = Boolean(search || area || categoryId);

  return <main className="page-shell">
    <header className="topbar">
      <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
      <nav className="nav-actions" aria-label="Main"><Link href="/dashboard" className="button button-quiet">My account</Link><CartLink/></nav>
    </header>
    <section className="section-heading">
      <p className="eyebrow">Thohoyandou pilot</p>
      <h1>Shop close to home.</h1>
      <p className="muted">Products from sellers in your neighbourhood.</p>
    </section>
    <form method="get" className="market-filter-form" role="search">
      <label>Product<input name="search" type="search" placeholder="Search products" maxLength={80} defaultValue={search}/></label>
      <label>Area<input name="area" placeholder="For example: Thohoyandou" maxLength={80} defaultValue={area}/></label>
      <label>Category<select name="category" defaultValue={categoryId}><option value="">All categories</option>{(categories ?? []).map(category => <option key={category.id} value={category.id}>{category.name_en}</option>)}</select></label>
      <button className="button button-primary" type="submit">Search</button>
      {hasFilters && <Link href="/marketplace" className="text-link">Clear filters</Link>}
    </form>
    {error
      ? <p className="notice">We could not load products. Check your network and try again.</p>
      : productsWithPhotos.length
        ? <>
          <p className="results-line" aria-live="polite">{productsWithPhotos.length} {productsWithPhotos.length === 1 ? 'product' : 'products'} found</p>
          <div className="product-grid">{productsWithPhotos.map((product) => {
            const shop = product.shop;
            const photoUrl = product.photoUrl;
            const shopPhotoUrl = product.shopPhotoUrl;
            const lowStock = product.stock_quantity <= 3;
            return <article className="product-card" key={product.id}>
              {photoUrl ? <Image className="market-product-photo" src={photoUrl} alt={product.name} width={640} height={480} unoptimized/> : <div className="product-placeholder" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</div>}
              <div className="product-content">
                <div className="market-shop-line">{shopPhotoUrl && <Image src={shopPhotoUrl} alt="" width={40} height={40} unoptimized/>}<p className="muted-small">{shop?.name}, {shop?.area}</p></div>
                <h2>{product.name}</h2>
                <p className="price">R {Number(product.price).toFixed(2)}</p>
                <p className={lowStock ? 'muted-small stock-low' : 'muted-small'}>{lowStock ? `Only ${product.stock_quantity} left` : `${product.stock_quantity} available`}</p>
                <AddToCartButton productId={product.id} productName={product.name} price={Number(product.price)} stock={product.stock_quantity} shopId={shop?.id ?? ''} shopName={shop?.name ?? 'Local shop'} deliveryFee={Number(shop?.delivery_fee ?? 0)} offersCollection={shop?.offers_collection ?? true} offersDelivery={shop?.offers_delivery ?? false}/>
              </div>
            </article>;
          })}</div>
        </>
        : <div className="empty-state"><span className="feature-icon" aria-hidden="true">⌕</span><h2>{hasFilters ? 'No products match your search.' : 'Sellers are getting their shops ready.'}</h2><p>{hasFilters ? 'Try a different product name, area or category.' : 'Products will show here as soon as pilot sellers publish them. Check back soon.'}</p>{hasFilters && <p style={{ marginTop: 16 }}><Link href="/marketplace" className="button button-secondary">Clear filters</Link></p>}</div>}
  </main>;
}
