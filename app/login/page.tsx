import AuthForm from '../components/AuthForm';
import { getEnv } from '@/src/server/config/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log in to Onselli' };
export default function LoginPage() {
  const env = getEnv();
  return <AuthForm mode="login" googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)} />;
}
