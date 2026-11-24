import AuthForm from '../components/AuthForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log in to Onselli' };
export default function LoginPage() {
  // Rendering the login screen only needs to know whether Google OAuth is configured.
  // Avoid validating unrelated production integrations (email, QStash, billing) here.
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <AuthForm mode="login" googleEnabled={googleEnabled} />;
}
