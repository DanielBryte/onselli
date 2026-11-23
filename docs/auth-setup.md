# Authentication setup

Onselli uses Better Auth for email/password accounts, email verification, password recovery, OAuth, sessions, application roles, and administrator two-factor authentication. Better Auth stores its identity tables in the Neon Postgres database through Drizzle.

## Required environment

- `DATABASE_URL`: Neon pooled connection string.
- `DATABASE_URL_UNPOOLED`: Neon direct connection string used by Drizzle migrations.
- `BETTER_AUTH_SECRET`: random secret with at least 32 characters.
- `NEXT_PUBLIC_APP_URL`: local or deployed application origin.
- `ZEPTOMAIL_SEND_API_KEY`, `ZEPTOMAIL_API_URL`, `ZEPTOMAIL_FROM_EMAIL`, and `ZEPTOMAIL_FROM_NAME`: ZeptoMail delivery for verification, password reset, and platform notification messages. Use the API endpoint for your account's data center and a verified sender address.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: OAuth credentials for Google sign-in. Both are required in production; local development can omit them while setting up email sign-in.
- For production, also set the QStash variables documented in [workflow-setup.md](./workflow-setup.md); production environment validation requires them.

Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google OAuth Web application. Add `http://localhost:3000` (and your deployed origin) under Authorized JavaScript origins. Add `http://localhost:3000/api/auth/callback/google` (and the matching deployed callback URL) under Authorized redirect URIs. Better Auth handles the callback at `/api/auth/callback/google`. Admin accounts must sign in with email and password so the authenticator challenge is enforced; social sign-in sessions are denied for admin users.

## Local setup

1. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`, Neon `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, and a newly generated `BETTER_AUTH_SECRET`.
2. Set the ZeptoMail API URL for your account region, its Send Mail API key, and a verified sender address/name. This is needed for verification and password reset emails. Add Google OAuth credentials when you want to enable the Google button locally; production requires them.
3. Run `npm run db:migrate` to create the identity and application tables.
4. Start the app with `npm run dev`, sign up, then open the verification link delivered to your inbox.
5. Choose your persona at `/onboarding`. Buyers continue to `/discover`; creators continue through `/workspace/setup` and then to `/workspace`. Buyers open purchases at `/dashboard/learning` and courses at `/dashboard/learning/courses/[productId]`. Guest buyers use the verified link on their receipt to establish a private purchase session.

Admin accounts are provisioned by an operator by setting the account's `admin_role` in the database; that field is not available in signup or onboarding. After signing in, an admin without two-factor enabled is directed to `/two-factor` to enroll an authenticator app and save backup codes. Sign-in challenges use the same page. The current admin workspace is `/admin`.

For a local secret, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and paste the output as `BETTER_AUTH_SECRET`. Keep the same secret across restarts and deployments that share sessions.

Do not reuse the example secret or commit `.env.local`. Better Auth roles and onboarding state are written server-side; never trust role values supplied by a browser form.
