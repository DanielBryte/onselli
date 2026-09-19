import { z } from 'zod';
import { listingKinds, locationModes } from '@onselli/types';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens');
const optionalUrl = z.string().url().optional();

export const businessOnboardingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slug.max(100),
  locationMode: z.enum(locationModes),
  address: z.string().trim().min(5).max(250).optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  serviceRadiusMeters: z.number().int().positive().max(500_000).optional(),
  onlineUrl: optionalUrl,
}).superRefine((value, context) => {
  if (value.locationMode === 'PHYSICAL' && (!value.address || value.latitude === undefined || value.longitude === undefined)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Physical businesses require an address and map coordinates.' });
  if (value.locationMode === 'SERVICE_AREA' && !value.serviceRadiusMeters) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Service-area businesses require a service radius.' });
  if (value.locationMode === 'ONLINE' && !value.onlineUrl) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Online businesses require a public web or social URL.' });
});

export const listingSchema = z.object({
  businessId: z.string().uuid(), categoryId: z.string().uuid().optional(), kind: z.enum(listingKinds),
  title: z.string().trim().min(3).max(160), slug: slug.max(150), description: z.string().trim().min(20).max(10_000),
  priceAmount: z.number().nonnegative().optional(), currency: z.string().length(3).toUpperCase().optional(),
}).refine((value) => (value.priceAmount === undefined) === (value.currency === undefined), 'Price and currency must be provided together.');

export type BusinessOnboardingInput = z.infer<typeof businessOnboardingSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
