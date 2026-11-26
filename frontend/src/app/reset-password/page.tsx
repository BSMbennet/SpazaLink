import Link from 'next/link';
import { updatePassword } from '@/app/actions/auth';

type PageProps = { searchParams: Promise<{ message?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
    <p className="eyebrow">Secure your account</p><h1>Choose a new password</h1>
    <p className="muted">Use at least 10 characters. This form works after you open the reset link sent to your email.</p>
    {message && <p className="notice" role="alert">{message}</p>}
    <form action={updatePassword} className="form-stack">
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required/></label>
      <button className="button button-primary" type="submit">Update password</button>
    </form>
    <p className="form-foot"><Link href="/forgot-password">Request another reset link</Link></p>
  </section></main>;
}
