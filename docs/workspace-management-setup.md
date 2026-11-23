# Workspace management and logo storage

Onselli workspaces are creator records owned by one account. Each workspace has its own dashboard, storefront, products, and site pages. The account-level plan controls how many workspaces the owner can create. Existing accounts use the current `creators.avatar_key` column for the optional workspace logo; no database migration is needed.

## Configure logo storage

Workspace logos are public brand assets. Keep them separate from paid downloads: **do not attach a public domain to `R2_BUCKET_NAME` or expose the digital-products bucket.** Create a dedicated Cloudflare R2 bucket for example `onselli-public-assets` and use it only for public workspace logos.

1. In Cloudflare, create the public-assets bucket. Attach a custom domain such as `assets.onselli.com` to this bucket and wait for Cloudflare to finish the domain and TLS setup.
2. Create an R2 API token with Object Read & Write permission scoped to the public-assets bucket. The current R2 client uses `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`; scope the token to the logo bucket and any existing bucket the application must continue accessing. Do not use account-wide credentials where a bucket-scoped token will work.
3. Set these server-side environment variables in local development and in each deployed environment:

   ```dotenv
   R2_ACCOUNT_ID=<Cloudflare account ID>
   R2_ACCESS_KEY_ID=<bucket-scoped token access key>
   R2_SECRET_ACCESS_KEY=<bucket-scoped token secret>
   R2_BUCKET_NAME=onselli-digital-products
   R2_PUBLIC_BUCKET_NAME=onselli-public-assets
   R2_PUBLIC_BASE_URL=https://assets.onselli.com
   ```

   Keep the `R2_*` credentials server-only. Never add them to `NEXT_PUBLIC_*` variables or commit actual values. `R2_BUCKET_NAME` stays private for digital downloads; logo uploads use only `R2_PUBLIC_BUCKET_NAME`.
4. Redeploy/restart the app after adding the variables. Logo uploads are sent through the authenticated Onselli API, which validates PNG, JPEG, or WebP content and a 2 MB limit before writing to R2. Browser-to-R2 CORS configuration is not needed.
5. Verify that a newly uploaded logo loads at `R2_PUBLIC_BASE_URL/<returned-key>` and that an object in the private digital-products bucket is not publicly reachable.

If a custom domain is unavailable in local development, logos can still be omitted and the workspace displays its initial. Configure the public domain before expecting uploaded logos to render.

## Plan and Bachs configuration

Workspace counts are checked on the server using `PLAN_CATALOG` (`Free: 1`, `Pro: 3`, `Studio: 10`) inside the workspace-create transaction. This cap remains enforced even while subscription checks are disabled. The workspace manager shows the pricing modal at the cap; Bachs checkout only becomes actionable when billing is enabled.

For live subscription checkout, configure `SUBSCRIPTIONS_ENABLED=true`, `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, and all four monthly/yearly Pro/Studio product IDs in the deployment environment, then configure Bachs to send subscription lifecycle webhooks to the application's billing webhook endpoint. Verify each product's USD price and recurrence interval, webhook signature, and account entitlements before enabling checkout.

## Workspace APIs

- `GET /api/workspace/setup` reports the signed-in account's current workspace setup status.
- `POST /api/workspace/setup` creates the workspace, draft storefront, and home page in one database transaction, checks the plan cap, and switches the account to the new workspace.
- `PATCH /api/workspace/workspaces` switches to an active workspace after checking account ownership.
- `POST /api/workspace/workspaces/logo` stores an authenticated account-owned logo in the public-assets bucket.

The onboarding flow creates the first workspace and records the creator's country. Additional workspaces inherit the account's first workspace country so billing and regional defaults remain consistent across the account.
