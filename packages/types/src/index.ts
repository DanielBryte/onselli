export const platformRoles = ['CUSTOMER', 'BUSINESS_OWNER', 'BUSINESS_ADMIN', 'BUSINESS_STAFF', 'SUPPORT', 'ADMIN'] as const;
export type PlatformRole = (typeof platformRoles)[number];
export const membershipRoles = ['OWNER', 'ADMIN', 'STAFF'] as const;
export type MembershipRole = (typeof membershipRoles)[number];
export const locationModes = ['PHYSICAL', 'SERVICE_AREA', 'ONLINE'] as const;
export type LocationMode = (typeof locationModes)[number];
export const listingKinds = ['PRODUCT', 'SERVICE'] as const;
export type ListingKind = (typeof listingKinds)[number];
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';

export interface BusinessLocation {
  mode: LocationMode;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusMeters?: number;
  onlineUrl?: string;
}

export interface SearchProvider {
  search(input: SearchInput): Promise<SearchPage>;
}
export interface SearchInput { query?: string; categorySlug?: string; latitude?: number; longitude?: number; radiusMeters?: number; cursor?: string; limit: number; }
export interface SearchPage { items: SearchResult[]; nextCursor?: string; }
export interface SearchResult { id: string; kind: 'BUSINESS' | 'LISTING'; title: string; slug: string; sponsored: boolean; }
