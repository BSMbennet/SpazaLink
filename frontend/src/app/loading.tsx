export default function Loading() {
  return (
    <main className="page-shell" aria-busy="true" aria-label="Loading SpazaLink page">
      <section className="loading-state" role="status">
        <p className="loading-label">Loading page content…</p>
        <div className="skeleton skeleton-title" aria-hidden="true" />
        <div className="skeleton skeleton-copy" aria-hidden="true" />
        <div className="skeleton skeleton-copy-short" aria-hidden="true" />
        <div className="dashboard-grid" aria-hidden="true">
          <div className="feature-card"><div className="skeleton" /><div className="skeleton skeleton-copy" /></div>
          <div className="feature-card"><div className="skeleton" /><div className="skeleton skeleton-copy" /></div>
        </div>
      </section>
    </main>
  );
}
