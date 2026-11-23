import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '../db/schema';
import { getDatabase } from '../db';
import { getEnv } from '../config/env';
import { eq } from 'drizzle-orm';

const env = getEnv();
const socialProviders = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
  : undefined;

export const auth = betterAuth({
  appName: 'Onselli',
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
  database: drizzleAdapter(getDatabase(), { provider: 'pg', schema: {
    user: schema.users,
    session: schema.sessions,
    account: schema.accounts,
    verification: schema.verifications,
    twoFactor: schema.twoFactors,
  } }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import('../emails/send');
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { sendVerificationEmail } = await import('../emails/send');
      await sendVerificationEmail(user.email, url);
    },
  },
  socialProviders,
  logger: {
    // Better Auth errors may include OAuth state and code verifier values. In
    // development, suppress them so Next's error overlay does not turn a
    // transient auth/database failure into a blocking page. Production keeps
    // the framework's normal error reporting.
    disabled: process.env.NODE_ENV !== 'production',
  },
  plugins: [twoFactor({ issuer: 'Onselli' })],
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'buyer', input: false },
      persona: { type: 'string', required: false, input: false },
      adminRole: { type: 'string', required: false, input: false },
      onboardingCompletedAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session, context) => {
          const [user] = await getDatabase().select({ adminRole: schema.users.adminRole, twoFactorEnabled: schema.users.twoFactorEnabled })
            .from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);
          if (!user?.adminRole) return;
          // OAuth/social sign-in does not trigger Better Auth's 2FA challenge. Only allow an
          // admin session through first-factor email sign-in while enrolling, or after a verified code.
          if (!user.twoFactorEnabled && context?.path === '/sign-in/email') return;
          if (context?.path === '/two-factor/verify-totp' || context?.path === '/two-factor/verify-backup-code') return;
          return false;
        },
      },
    },
  },
  advanced: { database: { generateId: 'uuid' } },
});
