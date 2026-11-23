import { z } from 'zod';

export const formFieldTypes = ['short_text', 'long_text', 'email', 'phone', 'number', 'dropdown', 'single_choice', 'multiple_choice', 'date'] as const;
export type FormFieldType = typeof formFieldTypes[number];
export const formFieldSchema = z.object({
  id: z.string().min(1).max(80), type: z.enum(formFieldTypes), label: z.string().trim().min(1).max(120),
  helpText: z.string().max(300).optional(), placeholder: z.string().max(160).optional(), required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export function submissionSchema(input: unknown) {
  const fields = z.array(formFieldSchema).max(50).parse(input);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    let value: z.ZodTypeAny;
    switch (field.type) {
      case 'long_text': value = z.string().trim().max(5_000); break;
      case 'email': value = z.string().trim().email().max(254); break;
      case 'phone': value = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/); break;
      case 'number': value = z.coerce.number().finite(); break;
      case 'date': value = z.string().date(); break;
      case 'dropdown': case 'single_choice': value = z.string().refine((answer) => field.options?.includes(answer) ?? false, 'Choose one of the listed options.'); break;
      case 'multiple_choice': value = z.array(z.string()).max(50).refine((answers) => answers.every((answer) => field.options?.includes(answer) ?? false), 'Choose from the listed options.'); break;
      default: value = z.string().trim().max(500);
    }
    shape[field.id] = field.required ? value : value.optional().or(z.literal(''));
  }
  return z.object(shape).strict();
}

export const formSettingsSchema = z.object({
  title: z.string().trim().min(2).max(140), slug: z.string().trim().toLowerCase().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(['draft', 'published']).default('draft'), fields: z.array(formFieldSchema).max(50),
  settings: z.object({ description: z.string().max(1_000).default(''), buttonText: z.string().trim().min(1).max(40).default('Submit'), successMessage: z.string().max(500).default('Thanks for reaching out.'), redirectUrl: z.string().url().optional(), notificationEmails: z.array(z.string().email()).max(10).default([]), confirmationEmail: z.boolean().default(false), confirmationMessage: z.string().max(500).optional(), closesAt: z.string().datetime().optional(), maxSubmissions: z.number().int().positive().optional(), onePerEmail: z.boolean().default(false), poweredBy: z.boolean().default(true) }).partial().default({}),
});
