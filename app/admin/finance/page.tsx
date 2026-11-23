import { redirect } from 'next/navigation';
import { AuthorizationError, getCurrentSession, requireAdmin } from '@/src/server/auth/permissions';
import FinanceConsole from './FinanceConsole';

export default async function AdminFinancePage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login?next=%2Fadmin%2Ffinance');
  try {
    await requireAdmin('process_refunds');
  } catch (error) {
    if (error instanceof AuthorizationError) return <main className="page-shell"><section className="page-content"><span className="section-kicker">ADMIN ACCESS</span><h1 className="page-title">Finance access restricted</h1><p className="page-subtitle">This workspace requires an authorized finance or compliance role with two-factor sign-in.</p></section></main>;
    throw error;
  }
  return <FinanceConsole />;
}
