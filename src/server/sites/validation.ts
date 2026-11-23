import { z } from 'zod';

export const siteSectionTypes = [
  'hero', 'rich_text', 'product_grid', 'featured_product', 'course_grid',
  'form', 'testimonials', 'stats', 'faq', 'image', 'video', 'cta', 'social_links',
  'newsletter', 'contact',
] as const;

export const siteSectionSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(siteSectionTypes),
  visible: z.boolean().default(true),
  content: z.object({
    eyebrow: z.string().max(120).optional(),
    title: z.string().max(180).optional(),
    body: z.string().max(4_000).optional(),
    buttonText: z.string().max(60).optional(),
    buttonUrl: z.string().max(500).optional(),
    imageKey: z.string().max(500).optional(),
    items: z.array(z.object({ title: z.string().max(160), body: z.string().max(1_000).optional(), url: z.string().max(500).optional() })).max(20).optional(),
  }).default({}),
});

export const siteDraftSchema = z.object({
  pageId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  isHome: z.boolean(),
  sections: z.array(siteSectionSchema).max(40),
  seo: z.object({ title: z.string().max(70).default(''), description: z.string().max(160).default('') }),
  theme: z.object({ template: z.enum(['studio', 'editorial', 'minimal', 'warm', 'modern']).default('studio'), primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#014733'), background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff') }),
  publish: z.boolean().default(false),
});
export type SiteDraft = z.infer<typeof siteDraftSchema>;
