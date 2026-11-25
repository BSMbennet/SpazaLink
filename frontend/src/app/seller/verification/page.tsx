import Link from 'next/link';
import { redirect } from 'next/navigation';
import { submitSellerVerificationDocument } from '@/app/actions/admin';
import { createClient } from '@/lib/supabase/server';

type PageProps = { searchParams: Promise<{ message?: string }> };

export default async function SellerVerificationPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');
  const [{ data: profile }, { data: request }, { data: documents }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('role_requests').select('id').eq('user_id', userId).eq('requested_role', 'seller').limit(1).maybeSingle(),
    supabase.from('seller_verification_documents').select('id,document_type,status,submitted_at,review_notes').eq('user_id', userId).order('submitted_at', { ascending: false }).limit(20),
  ]);
  if (profile?.role !== 'seller' && !request) redirect('/dashboard');

  const messages: Record<string, string> = {
    uploaded: 'Your document was uploaded securely and is awaiting review.',
    invalid: 'Choose a document type and a PDF, JPG, PNG or WebP file up to 5 MB.',
    'upload-failed': 'The private upload failed. Please try again.',
    'save-failed': 'The file uploaded but its review record could not be saved. The temporary upload was removed; please try again.',
  };

  return <main className="page-shell">
    <header className="topbar"><Link href="/" className="brand-mark">Spaza<span>Link</span></Link><Link href="/dashboard" className="text-link">Dashboard</Link></header>
    <section className="section-heading"><p className="eyebrow">Seller onboarding</p><h1>Verification documents</h1><p className="muted">Upload only documents needed to verify your seller account. Files are private and visible only to you and authorised SpazaLink administrators.</p></section>
    {message && messages[message] && <p className="notice" role="status">{messages[message]}</p>}
    <section className="auth-card auth-card-wide">
      <h2>Submit a document</h2>
      <form action={submitSellerVerificationDocument} className="form-stack">
        <label>Document type<select name="documentType" defaultValue="identity" required><option value="identity">Identity document</option><option value="business">Business / trading document</option><option value="food_handling">Food handling / safety evidence</option><option value="other">Other supporting document</option></select></label>
        <label>Choose file<input type="file" name="document" accept=".pdf,image/jpeg,image/png,image/webp" required /></label>
        <p className="muted-small">Accepted formats: PDF, JPEG, PNG and WebP. Maximum file size: 5 MB. Do not upload unnecessary personal information.</p>
        <button className="button button-primary" type="submit">Upload securely</button>
      </form>
    </section>
    <section className="section-heading"><h2>Your submissions</h2></section>
    {!documents?.length ? <p className="muted">No verification documents submitted yet.</p> : <div className="dashboard-grid">
      {documents.map(doc => <article className="feature-card" key={doc.id}><div className="order-status-row"><strong>{doc.document_type.replace('_',' ')}</strong><span className="status-pill">{doc.status}</span></div><p className="muted-small">Submitted {new Date(doc.submitted_at).toLocaleString('en-ZA')}</p>{doc.review_notes && <p className="notice">Review note: {doc.review_notes}</p>}</article>)}
    </div>}
  </main>;
}
