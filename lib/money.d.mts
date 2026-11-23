export function nairaToKobo(value: string | number): number;
export function koboToDecimal(minor: number): string;
export function currencyScale(currency: string): number;
export function isSafeMinorAmount(value: unknown): value is bigint;
export function decimalToCurrencyMinor(value: string | number, currency: string): bigint;
export function currencyMinorToDecimal(minor: string | number | bigint, currency: string): string;
export function currencyDecimalToMinor(value: string, currency: string): bigint;
export function roundBasisPoints(amountMinor: number, basisPoints: number): number;
