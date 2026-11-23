export const MAX_BUNDLE_PRODUCTS: number;
export function validateBundleComposition(input: { bundleProductId: string; creatorId: string; currency: string; selectedIds: string[]; products: any[] }): string | null;
export function snapshotBundleContents(products: any[]): Array<{ productIdSnapshot: string; productTypeSnapshot: string; titleSnapshot: string; currencySnapshot: string; priceMinorSnapshot: string; position: number }>;
export function bundleEntitlementProductIds(contents: any[]): string[];
export function shouldRevokeOrderEntitlements(input: { outcome: string }): boolean;
