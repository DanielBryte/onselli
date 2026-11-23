import { cookies, headers } from 'next/headers';
import { and, asc, eq } from 'drizzle-orm';
import { auth } from './index';
import { getCreatorLogoUrl } from '../workspaces/logo';

export type AdminPermission = 'read_creators' | 'support_creators' | 'review_kyc' | 'approve_payouts' | 'process_refunds' | 'moderate_content' | 'manage_settings' | 'view_audit' | 'adjust_ledger';
type AdminRole = 'support' | 'compliance' | 'finance' | 'super_admin';
const permissions: Record<AdminRole, readonly AdminPermission[]> = {
  support: ['read_creators', 'support_creators', 'moderate_content'],
  compliance: ['read_creators', 'review_kyc', 'process_refunds', 'view_audit'],
  finance: ['read_creators', 'approve_payouts', 'process_refunds', 'view_audit'],
  super_admin: ['read_creators', 'support_creators', 'review_kyc', 'approve_payouts', 'process_refunds', 'moderate_content', 'manage_settings', 'view_audit', 'adjust_ledger'],
};

export class AuthorizationError extends Error {
  constructor(message = 'You are not authorized to perform this action.') { super(message); this.name = 'AuthorizationError'; }
}

export async function getCurrentSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    // Protected routes fail closed when the session store is temporarily
    // unreachable. Callers already redirect unauthenticated users to sign in;
    // this prevents a transient Neon timeout from crashing the whole page.
    return null;
  }
}

export async function requireCreator() {
  const session = await getCurrentSession();
  if (!session?.user) throw new AuthorizationError('Sign in to continue.');
  const appUser = session.user as typeof session.user & { onboardingCompletedAt?: Date | null; role?: 'buyer' | 'creator' | 'admin' };
  if (!appUser.onboardingCompletedAt) throw new AuthorizationError('Complete onboarding to access this workspace.');
  if (appUser.role !== 'creator' && appUser.role !== 'admin') throw new AuthorizationError('Complete creator onboarding to access this workspace.');
  const { getDatabase } = await import('../db');
  const { creators } = await import('../db/schema');
  const workspaceId = (await cookies()).get('onselli_creator_id')?.value;
  const base = getDatabase().select().from(creators).where(and(eq(creators.userId, session.user.id), ...(workspaceId ? [eq(creators.id, workspaceId)] : [])));
  const [creator] = await base.orderBy(asc(creators.createdAt)).limit(1);
  if (!creator) throw new AuthorizationError('Complete creator setup to access this workspace.');
  if (creator.status !== 'active') throw new AuthorizationError('Your creator workspace is unavailable.');
  return { session, creator };
}

export async function getCreatorWorkspaces(userId: string) {
  const { getDatabase } = await import('../db');
  const { creators } = await import('../db/schema');
  const { and, asc, eq } = await import('drizzle-orm');
  const rows = await getDatabase().select({ id: creators.id, displayName: creators.displayName, slug: creators.slug, avatarKey: creators.avatarKey })
    .from(creators).where(and(eq(creators.userId, userId), eq(creators.status, 'active'))).orderBy(asc(creators.createdAt));
  return rows.map(({ avatarKey, ...workspace }) => ({ ...workspace, logoUrl: getCreatorLogoUrl(avatarKey) }));
}

export async function getCreatorWorkspaceCount(userId: string) {
  const { getDatabase } = await import('../db');
  const { creators } = await import('../db/schema');
  const { count, eq } = await import('drizzle-orm');
  const [result] = await getDatabase().select({ total: count() }).from(creators).where(eq(creators.userId, userId));
  return result?.total ?? 0;
}

export async function requireBuyer() {
  const session = await getCurrentSession();
  if (!session?.user) throw new AuthorizationError('Sign in to continue.');
  return session;
}

export async function requireAdmin(permission: AdminPermission) {
  const session = await requireBuyer();
  const appUser = session.user as typeof session.user & { adminRole?: AdminRole; twoFactorEnabled?: boolean };
  const role = appUser.adminRole;
  if (!role || !permissions[role]?.includes(permission)) throw new AuthorizationError();
  if (!appUser.twoFactorEnabled) throw new AuthorizationError('Complete two-factor sign-in to access admin tools.');
  return session;
}
