import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/server/auth/permissions';

export default async function DashboardEntryPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login?next=%2Fdashboard');

  const user = session.user as typeof session.user & {
    role?: string;
    adminRole?: string | null;
    onboardingCompletedAt?: Date | string | null;
  };

  const destination = user.adminRole
    ? '/admin'
    : user.role === 'buyer'
      ? '/dashboard/learning'
      : !user.onboardingCompletedAt
        ? '/onboarding'
        : '/workspace';

  redirect(destination);
}
