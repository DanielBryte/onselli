# Supabase Auth setup for development and production

Onselli uses Supabase Auth in the browser. Auth callbacks return to `/auth/callback`; the callback completes OAuth, email confirmation, and password recovery before sending the user to the requested page.

## App environment variables

Set these in the local `.env.local` and in each deployed web environment:

- `NEXT_PUBLIC_SUPABASE_URL`: the Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: that project’s publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by authenticated API routes. Never expose it with a `NEXT_PUBLIC_` prefix.

Use the same Supabase project across environments only if you intentionally want shared users and data. For isolated development and production, create separate Supabase projects and set each environment’s variables to the matching project.

## Supabase Auth URL configuration

In **Authentication → URL Configuration**:

- Set **Site URL** to the canonical production origin, for example `https://onselli.com`.
- Add `http://localhost:3000/**` for local development.
- Add the production app origin, for example `https://onselli.com/**` (and `https://www.onselli.com/**` if both hosts serve the app).
- Add any staging or preview origins you use. Keep the entries limited to domains you control.

The app uses the current browser origin for callback links, so the same auth code works on localhost, staging, and production when each origin is allowlisted.

## Email confirmation and recovery

Keep email confirmation enabled for production. Onselli sends confirmation and recovery links back through `/auth/callback`; recovery then continues to `/auth/reset-password`. Use Supabase’s normal confirmation and recovery email templates unless you have customized them. If customizing, preserve Supabase’s confirmation URL/token parameters and the redirect target.

Configure the email sender and SMTP provider in Supabase for production deliverability. Test confirmation, expired links, password recovery, and resend/rate-limit behavior using the development project before release.

## Social provider

Onselli offers Google sign-in alongside email and password. Enable Google under **Authentication → Providers** and enter the Google OAuth client credentials. In the Google provider console, set the callback/redirect URI to the Supabase callback URL shown in the Supabase provider settings (the Supabase project URL ending in `/auth/v1/callback`). The app’s post-auth destinations such as `/auth/callback` are configured in Supabase’s URL allow list above; they are not the provider-console callback URI.

Supabase automatically links a Google identity to an existing account when the email matches and is verified. This preserves the existing user ID and creator data while preventing an unverified email from being used to claim an account. Do not create a second account or manually link identities based only on a typed email address. Manual linking is a separate signed-in flow and is not needed for same-email Google sign-in.

Use separate development and production OAuth apps/credentials where provider policy or security requires it. Only request the basic profile and email scopes needed for sign-in.

## Verify before launch

1. Create an account and confirm the email on localhost.
2. Sign in and sign out with email/password.
3. Test Google sign-in using an email that has no Onselli account, then with the same verified email as an existing email/password account. Confirm both methods reach the same Supabase user and existing creator data.
4. Request a password reset, open the link, and save a new password.
5. Try an expired or reused link and confirm the page offers a way back to login or to request another link.
6. Repeat on the production domain using production Supabase and provider credentials.
