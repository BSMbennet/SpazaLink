import Link from 'next/link';
import { requestPasswordReset } from '@/app/actions/auth';

type PageProps = { searchParams: Promise<{ message?: string }> };

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
    <p className="eyebrow">Account help</p><h1>Reset your password</h1>
    <p className="muted">Enter the email address you used to join SpazaLink. We will send a reset link if an account matches.</p>
    {message && <p className="notice" role="status">{message}</p>}
    <form action={requestPasswordReset} className="form-stack">
      <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <button className="button button-primary" type="submit">Send reset link</button>
    </form>
    <p className="form-foot"><Link href="/login">Back to sign in</Link></p>
  </section></main>;
}
