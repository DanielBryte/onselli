export type ProductDescription = { schemaVersion: 1; text: string } | { schemaVersion: 2; document: unknown };
export function normalizeProductDescription(value: unknown): string;
export function productDescriptionContent(value: unknown): string;
export function productDescriptionHtml(value: unknown): string;
export function serializeProductDescription(value: string): ProductDescription;
