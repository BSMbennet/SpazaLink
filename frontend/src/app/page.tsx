import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home-shell">
      <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><nav className="nav-actions"><Link href="/marketplace">Browse shops</Link><Link href="/login">Sign in</Link><Link href="/sign-up" className="button button-primary">Join SpazaLink</Link></nav></header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">Made for neighbourhood trade</p><h1>Your local shops.<br/><span>One simple link.</span></h1><p className="hero-lede">Find everyday essentials, support small sellers, and order from businesses close to home.</p><div className="hero-actions"><Link href="/marketplace" className="button button-primary">Explore local shops</Link><Link href="/sign-up" className="button button-secondary">Start selling</Link></div><p className="pilot-note">Starting in Thohoyandou, Limpopo.</p></div>
        <div className="hero-art" aria-label="Photograph of a neighbourhood spaza shop and local market"><div className="sun-disc"/><div className="shop-illustration"><div className="awning"><i/><i/><i/><i/><i/></div><div className="shop-sign">SPAZA SHOP</div><div className="shop-front"><div className="shop-window"/><div className="shop-door"/></div><div className="shop-base"/></div><div className="floating-tag tag-one">Fresh kota</div><div className="floating-tag tag-two">Local groceries</div></div>
      </section>
      <section className="value-strip"><div><strong>Buy nearby</strong><span>Find products in your area.</span></div><div><strong>Support small sellers</strong><span>Help local businesses grow.</span></div><div><strong>Simple ordering</strong><span>Collection or seller delivery.</span></div></section>
      <footer className="site-footer"><span>© {new Date().getFullYear()} SpazaLink</span><Link href="/privacy">Privacy notice</Link><span>Built for the Thohoyandou pilot</span></footer>
    </main>
  );
}
