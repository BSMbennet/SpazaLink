'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="empty-state" role="alert" aria-live="assertive">
        <span className="feature-icon" aria-hidden="true">!</span>
        <h1>We could not load this page.</h1>
        <p>Please check your connection and try again. Your account and order information have not been changed by this message.</p>
        <div className="form-actions" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button className="button button-primary" type="button" onClick={() => reset()}>Try again</button>
        </div>
      </section>
    </main>
  );
}
