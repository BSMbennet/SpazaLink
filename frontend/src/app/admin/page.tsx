import { redirect } from 'next/navigation';
import { reviewRoleRequest, reviewSellerDocument, reviewShop } from '@/app/actions/admin';
import { createClient } from '@/lib/supabase/server';
import { signedR2ObjectUrl } from '@/lib/r2';

type PageProps = { searchParams: Promise<{ notice?: string }> };
type Profile = { id: string; full_name: string | null; phone: string | null };

function ReviewNote() {
  return <label>Review note (optional)<textarea name="notes" maxLength={500} rows={2} placeholder="Explain what is needed or why this decision was made." /></label>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (authError || !userId) redirect('/login');
  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (adminProfile?.role !== 'admin') redirect('/dashboard');

  const [roleResult, documentResult, shopResult] = await Promise.all([
    supabase.from('role_requests').select('id,user_id,requested_role,status,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(100),
    supabase.from('seller_verification_documents').select('id,user_id,document_type,object_path,status,submitted_at').eq('status','pending').order('submitted_at',{ascending:true}).limit(100),
    supabase.from('shops').select('id,owner_id,name,description,phone,address_text,area,status,verification_status,created_at').in('verification_status',['pending','rejected']).order('created_at',{ascending:true}).limit(100),
  ]);
  const roleRequests = roleResult.data ?? [];
  const documents = documentResult.data ?? [];
  const shops = shopResult.data ?? [];
  const ownerIds = [...new Set([...roleRequests.map(r=>r.user_id),...documents.map(d=>d.user_id),...shops.map(s=>s.owner_id)])];
  const { data: profileRows } = ownerIds.length
    ? await supabase.from('profiles').select('id,full_name,phone').in('id',ownerIds)
    : { data: [] as Profile[] };
  const profiles = new Map((profileRows ?? []).map((p: Profile)=>[p.id,p] as const));
  const signedDocuments = await Promise.all(documents.map(async doc => {
    let signedUrl: string | null = null;
    try { signedUrl = await signedR2ObjectUrl(doc.object_path, 60); } catch { signedUrl = null; }
    return { ...doc, signedUrl };
  }));
  const messages: Record<string,string> = {
    updated: 'Review saved successfully.',
    invalid: 'The submitted review details were invalid.',
    failed: 'The review could not be saved. Check that the seller has an approved verification document before approving the shop, then refresh.',
  };

  return <main className="page-shell">
<section className="section-heading"><p className="eyebrow">Administration</p><h1>Verification queue</h1><p className="muted">Review access requests, private seller documents and shop listings before they become available.</p></section>
    {notice && messages[notice] && <p className="notice" role="status">{messages[notice]}</p>}
    {(roleResult.error || documentResult.error || shopResult.error) && <p className="notice">One or more review queues could not be loaded. Refresh the page.</p>}

    <section className="section-heading"><h2>Seller and agent access requests</h2><p className="muted-small">{roleRequests.length} pending</p></section>
    {!roleRequests.length ? <p className="muted">No pending role requests.</p> : <div className="dashboard-grid">{roleRequests.map(request => {
      const person=profiles.get(request.user_id);
      return <article className="feature-card" key={request.id}>
        <span className="status-pill">{request.requested_role} request</span><h3>{person?.full_name ?? 'Name not supplied'}</h3><p className="muted-small">{person?.phone ?? 'No phone number'} · {new Date(request.created_at).toLocaleString('en-ZA')}</p>
        <form action={reviewRoleRequest} className="form-stack"><input type="hidden" name="requestId" value={request.id}/><ReviewNote/><div className="form-actions"><button className="button button-primary" name="decision" value="approve">Approve access</button><button className="button button-quiet" name="decision" value="reject">Reject</button></div></form>
      </article>;
    })}</div>}

    <section className="section-heading"><h2>Private seller documents</h2><p className="muted-small">{documents.length} pending</p></section>
    {!documents.length ? <p className="muted">No seller documents awaiting review.</p> : <div className="dashboard-grid">{signedDocuments.map(document => {
      const person=profiles.get(document.user_id);
      return <article className="feature-card" key={document.id}>
        <span className="status-pill">{document.document_type.replace('_',' ')}</span><h3>{person?.full_name ?? 'Seller applicant'}</h3><p className="muted-small">{person?.phone ?? 'No phone number'} · {new Date(document.submitted_at).toLocaleString('en-ZA')}</p>
        {document.signedUrl ? <p><a className="text-link" href={document.signedUrl} target="_blank" rel="noreferrer">Open private document (60-second link) ↗</a></p> : <p className="muted-small">A temporary document link could not be created.</p>}
        <form action={reviewSellerDocument} className="form-stack"><input type="hidden" name="documentId" value={document.id}/><ReviewNote/><div className="form-actions"><button className="button button-primary" name="decision" value="approve">Approve document</button><button className="button button-quiet" name="decision" value="reject">Reject</button></div></form>
      </article>;
    })}</div>}

    <section className="section-heading"><h2>Shop verification</h2><p className="muted-small">{shops.length} pending</p></section>
    {!shops.length ? <p className="muted">No shops awaiting verification.</p> : <div className="dashboard-grid">{shops.map(shop => {
      const person=profiles.get(shop.owner_id);
      return <article className="feature-card" key={shop.id}>
        <span className="status-pill">Shop pending</span><h3>{shop.name}</h3><p className="muted-small">Owner: {person?.full_name ?? 'Unknown'} · {person?.phone ?? shop.phone ?? 'No phone'} </p>
        <p>{shop.description}</p><p className="muted-small">{shop.address_text}, {shop.area}</p>
        <form action={reviewShop} className="form-stack"><input type="hidden" name="shopId" value={shop.id}/><ReviewNote/><div className="form-actions"><button className="button button-primary" name="decision" value="approve">Approve shop</button><button className="button button-quiet" name="decision" value="reject">Reject</button><button className="button button-quiet" name="decision" value="suspend">Suspend</button></div></form>
      </article>;
    })}</div>}
  </main>;
}
