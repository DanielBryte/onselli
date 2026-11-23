# Upstash Workflow setup

Onselli uses Upstash Workflow for durable campaign delivery and form notifications. Upstash Workflow runs on QStash. The separate Upstash Redis REST credentials are only used by public API rate limiting.

## Local development

Set `QSTASH_DEV=true` and `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`. Use a development database and Bachs sandbox credentials. Start the app with `npm run dev` first; the SDK starts its local QStash development server and does not need a real QStash token or signing keys. In a second terminal, run `npm run jobs:sync-schedules`. The script loads `.env.local`, detects local mode, and registers the same four schedules against localhost. The QStash development server stores schedules in memory, so they disappear when it stops. This lets you exercise the recurring reconciliation locally without creating schedules in the production QStash account.

## Production credentials

Create or open the QStash project in the Upstash Console, then copy its token and both signing keys into the deployment environment:

- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `QSTASH_URL` only if the Upstash Console gives your account a regional API URL; otherwise leave it blank.

Set `QSTASH_DEV=false` and `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin. Keep the signing keys in server-only environment variables. The Workflow `serve()` handlers verify QStash signatures before processing requests.

## Register recurring jobs

Deploy the application first so the signed maintenance endpoint is reachable. Then run `npm run jobs:sync-schedules` in an environment that has the production `QSTASH_TOKEN` and deployed `NEXT_PUBLIC_APP_URL` configured. This creates or updates four stable QStash schedules: campaign recovery every two minutes, pending order expiry every five minutes, creator hold release hourly, and payout plus sale reconciliation every five minutes. Running the command again updates the same schedules instead of creating duplicates. Check them in the Upstash Console after syncing.

Campaign sends and form notification workflows are triggered by the application; they do not require schedules. Scheduled campaigns are submitted to QStash with a delivery delay when the creator schedules them.
