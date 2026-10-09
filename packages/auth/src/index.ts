import type { PlatformRole } from '@onselli/types';

export const canManageCreator = (role: PlatformRole): boolean => role === 'CREATOR' || role === 'ADMIN';
