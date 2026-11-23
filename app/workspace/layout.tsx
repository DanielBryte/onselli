import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCreatorWorkspaceCount, getCreatorWorkspaces, getCurrentSession, requireCreator } from '@/src/server/auth/permissions';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import type { PlanId } from '@/src/server/billing/plans';
import { CreatorWorkspaceIdentityProvider } from './CreatorWorkspaceIdentity';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login?next=%2Fworkspace');

  let value: { workspaceName: string; workspaceSlug: string; workspaceLogoUrl: string | null; firstName: string; activeWorkspaceId: string; workspaces: { id: string; displayName: string; slug: string; logoUrl: string | null }[]; workspaceCount: number; planId: PlanId; billingEnabled: boolean } = { workspaceName: '', workspaceSlug: '', workspaceLogoUrl: null, firstName: '', activeWorkspaceId: '', workspaces: [], workspaceCount: 0, planId: 'free', billingEnabled: false };

  try {
    const { creator, session } = await requireCreator();
    const [workspaces, workspaceCount, entitlements] = await Promise.all([
      getCreatorWorkspaces(session.user.id),
      getCreatorWorkspaceCount(session.user.id),
      getAccountEntitlements(session.user.id),
    ]);
    value = {
      workspaceName: creator.displayName.trim(),
      workspaceSlug: creator.slug,
      workspaceLogoUrl: workspaces.find((workspace) => workspace.id === creator.id)?.logoUrl ?? null,
      firstName: session.user.name?.trim().split(/\s+/)[0] ?? '',
      activeWorkspaceId: creator.id,
      workspaces,
      workspaceCount,
      planId: entitlements.planId,
      billingEnabled: entitlements.billingEnabled,
    };
  } catch {
    // Creator setup and redirect states remain renderable without a workspace record.
  }

  return <CreatorWorkspaceIdentityProvider value={value}>{children}</CreatorWorkspaceIdentityProvider>;
}
