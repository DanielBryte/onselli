import { z } from 'zod';
import { creatorProductKinds } from '@onselli/types';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens');
const optionalUrl = z.string().url().optional();

export const creatorProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  slug: slug.max(100),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2_000).optional(),
  avatarUrl: optionalUrl,
  coverUrl: optionalUrl,
  socialLinks: z.record(z.string().max(40), z.string().url()).optional(),
});

export const creatorProductSchema = z.object({
  creatorId: z.string().uuid(),
  kind: z.enum(creatorProductKinds),
  title: z.string().trim().min(3).max(140),
  slug: slug.max(150),
  description: z.string().trim().min(10).max(6_000),
  priceAmount: z.number().nonnegative(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
});

export type CreatorProfileInput = z.infer<typeof creatorProfileSchema>;
export type CreatorProductInput = z.infer<typeof creatorProductSchema>;
