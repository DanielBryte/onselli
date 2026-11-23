import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthorizationError, getCurrentSession, requireAdmin } from '@/src/server/auth/permissions';

export default async function AdminHomePage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login?next=%2Fadmin');

  const currentUser = session.user as typeof session.user & { adminRole?: string | null; twoFactorEnabled?: boolean };
  if (currentUser.adminRole && !currentUser.twoFactorEnabled) {
    return <main className="page-shell"><section className="page-content"><span className="section-kicker">ADMIN SECURITY</span><h1 className="page-title">Secure your admin account</h1><p className="page-subtitle">Set up an authenticator app before opening admin tools.</p><Link href="/two-factor" className="button button--mint" style={{ marginTop: 24 }}>Set up two-factor sign-in</Link></section></main>;
  }

  try {
    await requireAdmin('read_creators');
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return <main className="page-shell"><section className="page-content"><span className="section-kicker">ADMIN ACCESS</span><h1 className="page-title">Access restricted</h1><p className="page-subtitle">This account is not authorized for the admin workspace, or its two-factor sign-in is incomplete.</p><Link href="/" className="button button--mint" style={{ marginTop: 24 }}>Return to Onselli</Link></section></main>;
    }
    throw error;
  }

  const user = session.user as typeof session.user & { adminRole?: string | null };
  const canApprovePayouts = user.adminRole === 'finance' || user.adminRole === 'super_admin';
  const canProcessRefunds = user.adminRole === 'finance' || user.adminRole === 'compliance' || user.adminRole === 'super_admin';

  return <main className="page-shell"><section className="page-content"><span className="section-kicker">ONSELLI OPERATIONS</span><h1 className="page-title">Admin workspace</h1><p className="page-subtitle">Signed in with {user.adminRole?.replaceAll('_', ' ')} access.</p>
    <div className="product-list" style={{ marginTop: 32 }}>
      {canApprovePayouts && <Link href="/admin/payouts" className="product-row" style={{ color: 'inherit', textDecoration: 'none' }}><div><span className="section-kicker">FINANCE</span><h2 style={{ margin: '6px 0', fontSize: 17 }}>Payout approvals</h2><p>Review and record creator payout decisions.</p></div><span aria-hidden="true">→</span></Link>}
      {canProcessRefunds && <Link href="/admin/finance" className="product-row" style={{ color: 'inherit', textDecoration: 'none' }}><div><span className="section-kicker">FINANCE</span><h2 style={{ margin: '6px 0', fontSize: 17 }}>Refunds &amp; disputes</h2><p>Review buyer cases, submit dispute evidence, and reconcile the Bachs platform balance.</p></div><span aria-hidden="true">→</span></Link>}
      {!canApprovePayouts && !canProcessRefunds && <div className="empty-state"><h2>Admin tools</h2><p>Your current role has no admin tools available in this workspace.</p></div>}
    </div>
  </section></main>;
}
