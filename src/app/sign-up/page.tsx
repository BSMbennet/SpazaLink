import Link from 'next/link';
import { signUp } from '@/app/actions/auth';
type PageProps = { searchParams: Promise<{ message?: string }> };
export default async function SignUpPage({ searchParams }: PageProps) {
  const { message } = await searchParams;
  return <main className="auth-shell"><section className="auth-card auth-card-wide">
    <Link href="/" className="brand-mark">Spaza<span>Link</span></Link>
    <p className="eyebrow">Join your local marketplace</p><h1>Create your account</h1>
    <p className="muted">Buy nearby, or apply to sell and grow your small business.</p>
    {message && <p className="notice" role="status">{message}</p>}
    <form action={signUp} className="form-stack">
      <label>Full name<input name="fullName" autoComplete="name" required maxLength={100} /></label>
      <label>Phone number <span className="muted-inline">(optional)</span><input name="phone" type="tel" autoComplete="tel" /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password <span className="muted-inline">(at least 10 characters)</span><input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>How will you use SpazaLink?<select name="role" defaultValue="buyer"><option value="buyer">I want to buy</option><option value="seller">I want to sell</option><option value="agent">I want to help local sellers join</option></select></label>
      <label className="consent-row"><input name="popiaConsent" type="checkbox" required /><span>I agree to the <Link href="/privacy" target="_blank">privacy notice</Link> and consent to SpazaLink using my details to provide this service.</span></label>
      <button className="button button-primary" type="submit">Create account</button>
    </form>
    <p className="form-foot">Already registered? <Link href="/login">Sign in</Link></p>
  </section></main>;
}
