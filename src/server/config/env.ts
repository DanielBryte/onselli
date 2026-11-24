import { z } from 'zod';

const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: optionalUrl,
  DATABASE_URL_UNPOOLED: optionalUrl,
  SUBSCRIPTIONS_ENABLED: z.enum(['true', 'false']).default('false'),
  BACHS_API_KEY: z.string().optional(),
  BACHS_WEBHOOK_SECRET: z.string().optional(),
  BACHS_PLAN_PRO_USD_PRODUCT_ID: z.string().optional(),
  BACHS_PLAN_STUDIO_USD_PRODUCT_ID: z.string().optional(),
  BACHS_PLAN_PRO_USD_YEARLY_PRODUCT_ID: z.string().optional(),
  BACHS_PLAN_STUDIO_USD_YEARLY_PRODUCT_ID: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BANK_DATA_ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ZEPTOMAIL_SEND_API_KEY: z.string().optional(),
  ZEPTOMAIL_API_URL: optionalUrl,
  ZEPTOMAIL_FROM_EMAIL: z.string().email().optional(),
  ZEPTOMAIL_FROM_NAME: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  AWS_REGION: z.string().optional(),
  R2_PUBLIC_BASE_URL: optionalUrl,
  R2_PUBLIC_BUCKET_NAME: z.string().optional(),
  SES_FROM_EMAIL: z.string().email().optional(),
  SES_CONFIGURATION_SET: z.string().optional(),
  SES_WEBHOOK_SECRET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  QSTASH_DEV: z.string().optional(),
  QSTASH_URL: optionalUrl,
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  SENTRY_DSN: optionalUrl,
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production') {
    // Keep the application bootable when an optional integration is disabled.
    // Auth pages and API handlers import this config, so requiring Google,
    // ZeptoMail, or QStash here can take down unrelated parts of the app.
    for (const key of ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const) {
      if (!value[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required in production` });
    }
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      const appUrl = new URL(value.NEXT_PUBLIC_APP_URL);
      if (appUrl.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(appUrl.hostname)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['NEXT_PUBLIC_APP_URL'], message: 'NEXT_PUBLIC_APP_URL must be a public HTTPS URL in production' });
      }
    }
    if (value.SUBSCRIPTIONS_ENABLED === 'true') {
      for (const key of ['BACHS_API_KEY', 'BACHS_WEBHOOK_SECRET', 'BACHS_PLAN_PRO_USD_PRODUCT_ID', 'BACHS_PLAN_STUDIO_USD_PRODUCT_ID', 'BACHS_PLAN_PRO_USD_YEARLY_PRODUCT_ID', 'BACHS_PLAN_STUDIO_USD_YEARLY_PRODUCT_ID'] as const) {
        if (!value[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when subscriptions are enabled` });
      }
    }
  }
});

let cached: z.infer<typeof envSchema> | undefined;
export function getEnv() {
  if (!cached) {
    // Next imports route handlers during `next build`; provide inert config for module initialization only.
    // Production runtime validation remains strict because NEXT_PHASE is not set on the deployed server.
    const buildEnvironment = process.env.NEXT_PHASE === 'phase-production-build';
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
    const values = {
      ...process.env,
      // Preview deployments get their own callback origin from Vercel unless
      // an explicit canonical URL has been configured.
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || vercelUrl || (buildEnvironment ? 'https://build.invalid' : undefined),
      ...(buildEnvironment ? {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'build-only-secret-not-valid-at-runtime-000000000000',
      } : {}),
    };
    cached = envSchema.parse(values);
  }
  return cached;
}
