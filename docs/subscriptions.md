# Plans and subscriptions

Subscription enforcement is controlled by `SUBSCRIPTIONS_ENABLED`.

- `false` (default): plan limits are bypassed so the full product can be exercised without billing.
- `true`: plan entitlements are enforced and monthly/yearly paid checkout is available through Bachs.

The plan catalog and price/limit source of truth is `src/server/billing/plans.ts`:

| Plan | Monthly | Yearly (save 2 months) | Workspaces | Published offers | Contacts | Campaign emails | Onselli fee on sales |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | $0 | 1 | 5 | 500 | Sending unavailable | 7.5% |
| Pro | $9/month | $90/year | 3 | Unlimited | 10,000 | Up to 5,000 recipients per send; credits prepaid | 5% |
| Studio | $24/month | $240/year | 10 | Unlimited | 50,000 | Up to 5,000 recipients per send; credits prepaid | 3% |

Yearly paid plans cost 10 monthly payments, so subscribers save the equivalent of two months. Processor fees are additional. Campaign sends consume prepaid credits; plans do not include a monthly email-credit allowance. Each workspace has one storefront. Contact caps count active contact records; form submissions remain saved even when the contact limit prevents creating a new CRM contact.

## Bachs setup

Create four recurring Bachs products: monthly Pro and Studio, and yearly Pro and Studio. Use monthly prices of $9 and $24, and yearly prices of $90 and $240. Set each product's billing cycle to match its term. The pricing selector sends customers to the matching product, and all recurring charges are in USD. Set the product IDs, API key, and webhook secret in the environment:

```env
SUBSCRIPTIONS_ENABLED=true
BACHS_API_KEY=...
BACHS_WEBHOOK_SECRET=...
BACHS_PLAN_PRO_USD_PRODUCT_ID=prod_...
BACHS_PLAN_STUDIO_USD_PRODUCT_ID=prod_...
BACHS_PLAN_PRO_USD_YEARLY_PRODUCT_ID=prod_...
BACHS_PLAN_STUDIO_USD_YEARLY_PRODUCT_ID=prod_...
```

Set the Bachs webhook endpoint to `https://<your-domain>/api/webhooks/bachs` and subscribe to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Signed webhooks are authoritative for paid access; the browser return page never grants access itself.

The pricing UI can display an optional local-currency estimate, but checkout is always charged in USD. Verify product IDs, product prices and billing cycles, webhook delivery, and customer portal plan-switch settings before enabling subscriptions in production.

The Bachs customer portal requires an API key with `customers:write` scope. Configure portal cancellation and plan-switch settings in Bachs; the dashboard's Manage plan action creates a fresh portal session on demand.
