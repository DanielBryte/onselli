import AuthForm from '../components/AuthForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create your Onselli account' };
export default function SignupPage() {
  // The signup screen only needs OAuth credentials to decide whether to show Google.
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <AuthForm mode="signup" googleEnabled={googleEnabled} />;
}
