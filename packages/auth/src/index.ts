import type { MembershipRole } from '@onselli/types';
export const canManageBusiness = (role: MembershipRole): boolean => role === 'OWNER' || role === 'ADMIN';
