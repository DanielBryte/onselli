# Bachs Connect creator payments

Onselli is the marketplace and remains responsible for the buyer checkout, refunds, disputes, and creator support. Checkout uses Bachs destination charges: the buyer pays Onselli, and the creator's share is routed to their Bachs recipient account. Bachs, not Onselli's local ledger, is the authority for the connected account's balance and payouts.

## Creator journey

1. When a creator finishes workspace onboarding, Onselli creates a recipient account server-side using an idempotency key and stores the provider account ID. Creators never enter provider IDs or API credentials.
2. A paid sale is confirmed from a signed Bachs webhook. The order and creator earning begin in `pending`; this does not mean the connected balance is available.
3. When Bachs reports the destination transfer, Onselli fetches the transfer and payment, verifies account, charge, gross transfer amount, currency, and final processing fee, then reconciles the local ledger. For Bachs' fee-first `platform_fee` split, the transfer record carries the sale gross and the platform fee is accounted for separately; creator earnings are gross less the platform fee. Bachs processing cost is charged against the platform's share and is not subtracted from the creator's ledger. The creator share only becomes withdrawable after Bachs confirms transfer settlement and payout readiness.
4. After the first successful sale, the Wallet offers a fresh Bachs hosted onboarding link. Returning from that link is not proof of verification. Account and capability webhooks plus a provider refresh determine whether payouts are approved.
5. The creator adds a supported bank, mobile-money, or exact asset/network destination under Settings → Payouts. Onselli stores the provider destination ID, status, currency, route, and masked display details; sensitive account data remains with Bachs.
6. The Wallet enables withdrawal only when Bachs reports an active payout capability, the selected destination is usable, the risk policy and confirmed route fee are configured, and both Bachs and the local source-currency ledger can cover the requested amount plus fee. Withdrawal calls use a stable idempotency reference; uncertain results remain reserved for reconciliation.

## Currency model and supported scope

Product base prices and creator ledger earnings are denominated in NGN or USD today. This matches Bachs Connect's current balance currencies: USD is the default connected balance, and NGN can be enabled for eligible Nigerian accounts. Destination payout currencies are separate from balance currencies. Current route mapping is NGN balance to Nigerian NGN bank payouts and USD balance to international bank, mobile-money, and supported crypto destinations, subject to Bachs' live account capabilities and route acceptance. Cross-currency routes require a fresh Bachs quote. The buyer's paid currency is stored separately from the order's creator-earning currency; the creator balance follows the verified Bachs transfer currency, not the buyer's display/charge currency. Do not show a buyer-paid amount as creator earnings.

Payout destinations are managed per creator and can use the bank, mobile-money, and exact crypto asset/network destinations currently returned by Bachs. The currencies endpoint is sourced from Bachs, and destination setup asks Bachs to validate the selected route. A listed currency is not a promise that every account or country can use it. International bank/mobile-money routes documented by Bachs require eligible account status and are funded from USD; NGN withdrawals to Nigerian banks use NGN. Other source/destination combinations require a current Bachs quote and must be supported by the account. Quotes are bound to the creator, destination, source/destination currencies, source amount, method, and expiry; the quote ID is submitted with the payout.

Creators initiate withdrawals from Wallet. Onselli reserves the source-currency amount and fee, submits the payout against that creator's connected account, and tracks the asynchronous provider result. Admins handle exceptions, not routine payout execution. Automatic schedules are not exposed. Withdrawals remain fail-closed until risk policy, reserve/recovery operations, and confirmed fees are configured. The route UI or API listing alone does not establish live account/route availability.

The Connect APIs are under `/api/workspace/payouts/connect`. `POST` creates or reuses the recipient account and issues a short-lived hosted onboarding link; `GET` refreshes provider status. `POST /api/workspace/payouts/quotes` creates a short-lived quote for cross-currency withdrawals. `POST /api/workspace/payouts` submits the creator-initiated withdrawal with its selected source currency and, when needed, the quote ID. `GET|POST /api/workspace/payouts/destinations` manages multiple verified Bachs destinations. Legacy local-ledger-only withdrawal submission returns `410`.

## Settlement, refunds, and disputes

Bachs destination-charge transfers are not automatically reversed when a buyer refund or lost dispute occurs. The refund or dispute debit hits Onselli's platform balance; the creator keeps the share already transferred. The webhook records completed refunds, revokes order access, and records dispute status/deadline without pretending the creator's balance was debited. The current settlement reconciler uses an explicit, versioned local withdrawal hold and does not estimate Bachs processing fees. This local hold is not a Bachs balance lock and does not itself secure funds for Onselli's refund/dispute liability. Finance/legal and Bachs must approve the actual reserve/recovery model before enabling payouts.

Authorized finance and compliance staff with two-factor sign-in can use `/admin/finance` to:

- Review paid orders with a matching successful Bachs charge, then issue a full refund after Bachs confirms the charge is refundable. Refunds use a stable idempotency reference, and an uncertain provider result stays blocked from duplicate submission until the webhook or provider review resolves it. A completed `refund.paid` event updates the order and revokes access; the webhook must be enabled for the platform account.
- Review dispute status and response deadline from Bachs, edit and save evidence directly to Bachs, then explicitly submit it. Submission is final. Evidence text is not persisted in Onselli; local database and audit entries store field names and operational metadata only. Upload supporting documents in Bachs and enter their returned attachment IDs in Onselli.
- Fetch the platform's provider-reported available and pending balances by currency and record an auditable balance review note. This is a read and audit snapshot, not a funds transfer or local-ledger adjustment.

Creators can request a refund review from a paid order in Workspace → Sales. The request is stored as `requested`; it does not call Bachs. Finance/compliance staff can approve and issue the full refund or decline it with a recorded reason. A staff member can also issue a full refund for a verified support case from the same finance page. Partial refunds and file uploads are not supported in Onselli's admin UI.

Destination-charge disputes belong to the platform, so the dispute webhook must match `BACHS_PLATFORM_ACCOUNT_ID`, not the creator's connected account ID. Configure the Bachs webhook endpoint to deliver platform and Connect events (`event_source=all`) and subscribe to `refund.created`, `refund.paid`, `refund.failed`, `dispute.created`, and `dispute.updated` as well as payment/transfer events. The admin queue cannot receive provider updates until that endpoint is configured and its signature is verified.

Withdrawal is fail-closed until all of these are configured:

- `BACHS_CREATOR_RISK_POLICY_VERSION`
- `BACHS_CREATOR_RESERVE_BPS` (0–10000, approved by finance/legal)
- `BACHS_CREATOR_RESERVE_HOLD_DAYS` (1–365, approved by finance/legal)
- `BACHS_PAYOUT_FEE_MINOR_BY_ROUTE` with each same-currency fee confirmed by Bachs, keyed as `SOURCE_CURRENCY:METHOD:DESTINATION_CURRENCY` in integer minor units (for example, `NGN:bank_transfer:NGN`). Cross-currency fees must come from the fresh Bachs quote.

These values are intentionally not guessed. A reserve alone does not make Onselli whole if refund/dispute liabilities exceed it. Before launch, finance/legal must approve how to debit reserves, handle negative creator balances, pause withdrawals, recover funds, and resolve refunds/disputes. Do not enable payouts until that policy and the provider's seller-funds model are confirmed. The admin operations and webhook routes are implemented, but the full financial lifecycle still needs a sandbox journey and real webhook/configuration verification before production use.

## Database and provider configuration

Apply unapplied migrations in order, including `drizzle/0011_bachs_payout_routes.sql`, `drizzle/0012_bachs_connect_destination_charges.sql`, `drizzle/0013_admin_finance_operations.sql`, `drizzle/0023_global_creator_payouts.sql`, and `drizzle/0024_international_payout_capability.sql`, before deploying. Configure `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, `BACHS_ENV`, and `BACHS_PLATFORM_ACCOUNT_ID`. The platform account needs destination-charge permissions and the webhook endpoint must subscribe to checkout/collection, transfer, account, capability, payout, refund, and dispute events. Verify event names and signing configuration in the Bachs dashboard for the deployed environment.

Schedule the authenticated Upstash maintenance workflow with payload `{ "task": "reconcile-payouts" }` at a short recurring interval (for example, every 5–10 minutes). It finds payouts processing for more than 15 minutes, looks up the exact creator-account payout reference, validates currency, amount and fees, then finalizes only provider-confirmed paid/failed outcomes. It also retries settlement reconciliation for verified paid orders whose transfer has not yet settled locally. Keep the workflow's failure logs connected to operations alerting. The admin finance screen shows failed/unprocessed webhook events, missing payout configuration, and manual reconciliation controls.

The destination-charge checkout request is created on Onselli's platform account and must not send `X-Account-Id`; it includes the recipient account as `transfer_data.destination` and exactly one split field. Provider transfer/payment IDs and the actual processing fee are persisted only after verification. KYC documents are never stored in Onselli or webhook payloads.

## Go-live checklist

- Confirm Bachs production account, API access, connected-recipient approval, NGN destination charges, NGN payouts, and required scopes with Bachs.
- Confirm whether a recipient account can receive/hold destination-charge proceeds before its payouts capability is active; do not represent funds as available until provider balance and settlement state confirm it.
- Apply migrations in order; include prior migrations only if they have not already been applied, and apply `drizzle/0013_admin_finance_operations.sql`. Configure the production webhook endpoint and secrets.
- Approve reserve, refund, dispute, negative-balance, and withdrawal-pause policy with finance/legal; set the versioned risk variables only after approval.
- Configure the exact payout fee and verify the amount/fee/debit response in Bachs sandbox or a documented provider test environment.
- Complete the entire sandbox journey: create recipient, hosted onboarding, paid checkout, transfer settlement, destination verification, withdrawal, and payout paid/failed. Verify duplicate and out-of-order webhook behavior.
- Configure the Bachs webhook endpoint with `event_source=all`, so platform-owned destination-charge refunds/disputes and Connect events reach Onselli. Verify refund and dispute event reconciliation and operational alerts before enabling live creator payouts.

The repository typecheck is useful for code consistency; it does not prove provider credentials, account capabilities, webhook subscriptions, settlements, refunds, or live payouts work.
