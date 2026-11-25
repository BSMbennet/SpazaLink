import Link from 'next/link';
import { signIn } from '@/app/actions/auth';
type PageProps = { searchParams: Promise<{ message?: string }> };
export default async function LoginPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  return <main className="auth-shell"><section className="auth-card">
    <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
    <p className="eyebrow">Welcome back</p><h1>Sign in</h1>
    <p className="muted">Manage your shop or find local essentials.</p>
    {message && <p className="notice" role="status">{message}</p>}
    <form action={signIn} className="form-stack">
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="button button-primary" type="submit">Sign in</button>
    </form>
    <p className="form-foot">New to SpazaLink? <Link href="/sign-up">Create an account</Link></p>
  </section></main>;
}
