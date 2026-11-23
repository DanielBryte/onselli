import { z } from 'zod';
import { isSafeMinorAmount } from '@/lib/money.mjs';
import { normalizeProductDescription } from '@/lib/product-description.mjs';

const reservedSlugs = new Set(['admin', 'api', 'dashboard', 'login', 'signup', 'checkout', 'library', 'learn', 'legal', 'blog', 'book', 'p', 'f', 'settings', 'support']);

export const creatorProfileInput = z.object({
  displayName: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine((value) => !reservedSlugs.has(value), 'This page address is reserved.'),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2_000).optional(),
  whatsappE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional().or(z.literal('')),
  timezone: z.string().min(1).max(64).default('Africa/Lagos'),
});

export const productInput = z.object({
  type: z.enum(['course', 'download', 'payment_link', 'bundle']),
  title: z.string().trim().min(3).max(140),
  slug: z.string().trim().toLowerCase().min(3).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine((value) => !reservedSlugs.has(value), 'This offer address is reserved.').optional(),
  description: z.string().max(100_000).default(''),
  priceMinor: z.coerce.bigint().refine(isSafeMinorAmount, 'Price must be a valid, safe minor-unit amount.'),
  currency: z.enum(['NGN', 'USD']).default('NGN'),
  currencyOptions: z.array(z.object({ currency: z.enum(['NGN','USD','GHS','KES','TZS','UGX','XAF','XOF','RWF','MWK','ZMW']), amountMinor: z.string().regex(/^\d{1,15}$/) }).strict()).max(0).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  contentAttested: z.boolean().optional().default(false),
  deliveryMode: z.enum(['uploaded_files', 'external_link']).optional(),
  externalUrl: z.string().max(2048).nullable().optional(),
  amountType: z.enum(['fixed', 'customer_chooses']).default('fixed'),
  minAmountMinor: z.coerce.bigint().refine(isSafeMinorAmount, 'Minimum amount must be a valid, safe minor-unit amount.').optional(),
  maxSales: z.number().int().positive().nullable().optional(),
  refundWindowDays: z.union([z.literal(0), z.literal(7), z.literal(14), z.literal(30)]).default(0),
  thankYou: z.object({ message: z.string().trim().max(500).default('') }).strict().optional(),
  initialLesson: z.string().trim().max(100_000).optional(),
}).superRefine((value, context) => {
  if (normalizeProductDescription(value.description).trim().length > 6_000) context.addIssue({ code: 'custom', path: ['description'], message: 'Keep the description under 6,000 characters.' });
  if (value.amountType === 'customer_chooses' && value.currency !== 'NGN') context.addIssue({ code: 'custom', path: ['currency'], message: 'Customer-chosen payment links currently support NGN only.' });
  if (value.type === 'payment_link' && value.amountType === 'fixed' && value.priceMinor === 0n) context.addIssue({ code: 'custom', path: ['priceMinor'], message: 'Payment links need a positive amount.' });
  if (value.type === 'payment_link' && value.amountType === 'customer_chooses' && (value.minAmountMinor ?? value.priceMinor) < 10_000n) context.addIssue({ code: 'custom', path: ['minAmountMinor'], message: 'The minimum amount for a payment link is ₦100.' });
  if (value.type === 'bundle' && value.amountType !== 'fixed') context.addIssue({ code: 'custom', path: ['amountType'], message: 'Bundles use a fixed one-time price.' });
});

export type CreatorProfileInput = z.infer<typeof creatorProfileInput>;
export type ProductInput = z.infer<typeof productInput>;
