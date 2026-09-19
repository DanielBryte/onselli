export const toNaira = (amount: number): string => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
