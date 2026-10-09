export const platformRoles = ['CREATOR', 'LEARNER', 'SUPPORT', 'ADMIN'] as const;
export type PlatformRole = (typeof platformRoles)[number];

export const creatorProductKinds = ['COURSE', 'DOWNLOAD', 'COACHING', 'WORKSHOP', 'COMMUNITY'] as const;
export type CreatorProductKind = (typeof creatorProductKinds)[number];
export const publicationStatuses = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'] as const;
export type PublicationStatus = (typeof publicationStatuses)[number];

export interface CreatorProfile {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  status: PublicationStatus;
}

export interface CreatorProduct {
  id: string;
  creatorId: string;
  kind: CreatorProductKind;
  title: string;
  slug: string;
  description: string;
  priceAmount: number;
  currency: string;
  status: PublicationStatus;
}

export interface CreatorOrder {
  id: string;
  buyerUserId: string;
  creatorId: string;
  productId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'DISPUTED';
  paymentProvider: 'bachs' | 'paystack';
}

export interface CreatorEntitlement {
  id: string;
  buyerUserId: string;
  productId: string;
  orderId: string;
  grantedAt: string;
  revokedAt?: string | null;
}
