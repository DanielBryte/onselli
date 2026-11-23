export function ownsProductFile(file: any, owner: { creatorId: string; productId: string }): boolean;
export function validateProductFileCompletion(file: any, object: { contentLength: number; contentType: string; signatureBytes: Uint8Array } | null, maxBytes: number): string | null;
export function canDownloadProductFile(input: { file: any; entitlement: any; order: any; userId?: string | null; guestBuyerId?: string | null }): boolean;
export function getDeliverableProductFiles<T extends { creatorId: string; productId: string; status: string }>(files: T[], owner: { creatorId: string; productId: string }): T[];
