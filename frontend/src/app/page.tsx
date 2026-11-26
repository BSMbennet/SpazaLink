import Link from 'next/link';

const QUICK_FIND = ['Kota', 'Bread', 'Drinks', 'Groceries'];

export default function HomePage() {
  return (
    <main className="home-shell">
      <header className="topbar">
        <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
        <nav className="nav-actions" aria-label="Main">
          <Link href="/marketplace">Browse shops</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/sign-up" className="button button-primary">Join SpazaLink</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Thohoyandou · Venda country · Local shops, closer to home</p>
          <h1>Order from the shop around the corner.</h1>
          <p className="hero-lede">Find what you need from local sellers, order in a few taps, then collect it or get it delivered by the seller.</p>
          <div className="hero-actions">
            <Link href="/marketplace" className="button button-primary">Find products near me</Link>
            <Link href="/sign-up" className="button button-secondary">Start selling</Link>
          </div>
          <ul className="hero-trust">
            <li>Pay cash on collection</li>
            <li>Collection or seller delivery</li>
          </ul>
        </div>
        <div className="hero-art" role="img" aria-label="A neighbourhood spaza shop" />
      </section>

      <section className="quick-find" aria-labelledby="quick-find-title">
        <h2 id="quick-find-title">What are you looking for?</h2>
        <div className="chip-row">
          {QUICK_FIND.map(term => (
            <Link key={term} className="chip" href={`/marketplace?search=${encodeURIComponent(term)}`}>{term}</Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" style={{ fontSize: '1.4rem', marginBottom: 14 }}>How it works</h2>
        <ol className="steps">
          <li className="step"><h3>Find a shop</h3><p>Search by product or area to see what local sellers have in stock.</p></li>
          <li className="step"><h3>Place your order</h3><p>Add items from one seller and choose collection or delivery.</p></li>
          <li className="step"><h3>Collect and pay</h3><p>Pay cash when you collect, or when the seller delivers.</p></li>
        </ol>
      </section>

      <section className="sell-band" aria-labelledby="sell-title">
        <div>
          <h2 id="sell-title">Have a shop, a stall or a kitchen?</h2>
          <p>List your products, set your prices and take orders from people nearby.</p>
        </div>
        <Link href="/sign-up" className="button">Open your shop page</Link>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} SpazaLink</span>
        <Link href="/privacy">Privacy notice</Link>
        <span>Rooted in Thohoyandou. Made for local trade.</span>
      </footer>
    </main>
  );
}
