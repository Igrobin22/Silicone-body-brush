# PureForm Backend Setup

Do not take live orders until a complete sandbox checkout has passed. The storefront alone is not proof that payments or order capture work.

## Current connection

- Both Cloudflare storefronts reference `hibfipskhksboubibwbz.supabase.co`.
- The existing `pureform` project was resumed and is responding on 17 October 2026. Its catalog and Auth health endpoints return HTTP 200. The initial Unhealthy warning has cleared: the project overview now reports Healthy.
- `admin-schema.sql` was applied successfully on 17 October 2026. The existing three product records are unchanged; the existing admin profile and login remain intact. There were no saved orders. Anonymous order insertion/access is denied, and staff cannot write payment fields.
- All three Edge Functions are deployed: `create-checkout-session`, `checkout-status`, and `stripe-webhook`. Dashboard deployments contain `payments.ts` beside `index.ts`; this is the same shared module with the handler import rewritten to `./payments.ts` and `Deno.serve(handler)` appended. CLI deployments use the source layout in this repository.
- The selected Stripe connection is **Buyxyz sandbox**, account `acct_1UQp9hA8lq0LYwUg`, in test mode.
- Sandbox webhook `we_1URUP8A8lq0LYwUg8TbxSwW8` was created for the four Checkout events below, using API version `2026-08-26.dahlia`. Its signing secret is not stored in this repository. Its connection here does not automatically give the deployed functions an API key.
- All five custom secrets below have been saved in Supabase, including the owner-entered restricted sandbox API key. Checkout configuration now returns HTTP 200. The dedicated active configuration is `pmc_1URUe0A8lq0LYwUg2fZ3Xg9z` (`PureForm cards only`): Cards on, Link/Apple Pay/Google Pay off. The account's Default configuration is unchanged.
- With the owner's confirmation, the webhook's legacy JWT check is now off; its deployed signature checks remain active. Checkout creation/status keep JWT verification enabled. Harmless deployed probes confirmed: unsigned request HTTP 400, valid signature HTTP 200, tampered payload HTTP 400. No order or payment was created by these probes.
- The owner created `PureForm Supabase sandbox` with Checkout Sessions Write and Promotion Codes Read only, and entered it directly into Supabase. Its value was not read by the agent or added to chat, screenshots or Git.
- A real hosted Stripe sandbox card payment passed on 17 October 2026; details are recorded below. No live payment was attempted. The separately approved admin-only update is pushed in `4a164c4`, and the restored original hero is pushed in `bb1207e`. Other pending navigation changes must be preserved when publishing checkout updates.
- The existing confirmed admin account is intact. The owner privately completed password recovery and signed into the published admin on 17 October 2026. Both sandbox orders, the three canonical products, discounts and restored stock are visible through the authenticated dashboard. No new admin account, role change, or shared password was needed.

## Admin Password Recovery

- Published page: `https://siliconebodybrush2.pages.dev/admin/reset-password.html` (Cloudflare serves the extensionless canonical path).
- Supabase Authentication > URL Configuration now uses that exact URL for Site URL and its sole allowed redirect. The previous `http://localhost:3000` default was incorrect. No wildcard callbacks, new admin users, or role changes were added.
- This Auth setting is separate from the Edge Function secret `SITE_URL`, which remains the storefront origin `https://siliconebodybrush2.pages.dev` without a path. Do not change the checkout secret to the recovery-page URL.
- The live recovery form successfully requested a fresh email for the existing owner. Earlier links may be expired or already used. The owner must open the newest email and enter/save a new password privately; do not read, copy, or share recovery tokens or passwords.
- The page verifies the recovery session with Supabase Auth before enabling password changes, uses an in-memory session, removes callback credentials from the URL, and submits passwords only to Supabase Auth. It does not write passwords to application tables or browser storage. No analytics run on this page.
- A subsequent owner click was rejected by Supabase before reaching the page: Auth server logs show `/verify`, HTTP 403, `One-time token not found` on 17 October 2026. This is not proof of a broken frontend redirect or of an email scanner; an older, replaced or previously used link is possible. The owner chose to keep recovery links rather than switch to email codes. The default reset template, expiry settings and admin permissions remain unchanged.
- Recovery diagnostics are pushed in `bbd5b6c`. The page now distinguishes a Supabase `otp_expired` callback, an unsupported callback, a connection/dependency failure, and an unverified session. It explicitly checks SDK initialization errors before accepting a session. It never displays raw error objects, tokens or passwords.
- Thirteen focused recovery tests pass, including invalid/expired callbacks, verified and expired sessions, safe fixed redirects, generic email responses, connection failures and password clearing. The owner confirmed completion, and Auth logs show successful recovery, HTTP 200 for the password update, and sign-out at 19:07 UAE time on 17 October 2026. A subsequent fresh admin sign-in was verified without reading credentials.

```powershell
node --experimental-vm-modules --test tests/admin-recovery.test.cjs
```

## Sandbox Verification: 17 October 2026

- Order `PF-261017-B90CE6`: one Grey, Black and Pink set, AED 125.58. Stripe returned test mode, card-only, complete and paid. The signed completed event was delivered with no pending webhooks. Supabase showed confirmed/paid with the correct items before the return-page status request was made.
- Inventory decreased once per set. Repeated payment verification did not deduct again. After verification, the paid sandbox order was explicitly cancelled for fulfillment, labeled `stripe_sandbox`, and its three test units restored. Its payment status remains paid, not falsely refunded. Do not fulfill this test order.
- Order `PF-261017-C53F29`: a tampered AED 0.01 Pink request correctly became AED 37.80 using the admin price. Stripe's public decline card was rejected; the order remained unpaid and the status endpoint returned `paid: false`. The actual Stripe session is now expired/unpaid, the saved admin order is cancelled/unpaid, and the signed expiry handling restored its Pink unit. Stock is Grey 24, Black 18, Pink 12 (54 total), with no remaining test holds.
- Local updated checkout confirmation passed at 390px and 1440px widths without horizontal overflow. The current live frontend has not yet been updated through Git/Cloudflare.
- Deployed checks rejected foreign delivery addresses, fractional quantities, unapproved origins, invalid promotion codes and anonymous order access. Unsigned/tampered webhook probes failed; a correctly signed harmless probe passed.
- Automated checks passed: two Deno suites with 15 test steps, 19 Node admin/recovery tests, JavaScript syntax checks, and all read-only backend checks. The admin-only commit `4a164c4` makes all payment controls read-only, omits payment fields from admin saves, labels sandbox orders and excludes them from customer revenue/new/open counts. Other storefront changes were not included in that commit.
- After deployment, the authenticated published dashboard showed both sandbox labels and disabled payment controls in the order table and detail form. Saving the cancelled paid sandbox order with unchanged status, fulfillment and notes succeeded. Its payment stayed paid, and refreshed inventory stayed at 54 units; customer revenue/new/open counts stayed zero. No real order, charge or stock adjustment was made by this admin save test.

## 1. Connect The Database

1. Use the existing `pureform` project, ref `hibfipskhksboubibwbz`. The authenticated Supabase dashboard is sufficient; the Supabase connector is not currently authorized.
2. The schema has already been applied. For future migrations, back up an existing database before applying changes. The SQL creates restrictive order permissions and payment functions; existing listing prices, stock, content, and historical order currencies are not overwritten.
3. Keep the existing owner login and admin profile. Only for a fresh installation: create an owner login in Supabase Authentication and add its UUID to `admin_profiles` using the bootstrap statement at the top of the SQL file. Never enable public self-registration as a way to grant admin access.
4. Set the confirmed project's URL and public/publishable key in `assets/pureform-supabase-config.js`, including `checkoutFunctionUrl`. A public key is expected in the browser; a service-role or Stripe secret key is never allowed there.
5. Open `/admin/`, sign in and verify the names, prices, discounts, actual stock and images for Grey, Black and Pink. Seeded inventory is sample data, not a physical stock count.

## UAE Delivery Update: 17 October 2026

- The owner approved **AED 10 flat delivery per order across the UAE** and authorized deployment in Buyxyz sandbox only. This is not approval to enable live payments.
- `migrations/20261017000100_uae_shipping.sql` adds `shipping_total` with a zero default for historical orders and adjusts signed-payment validation to include shipping. It was applied successfully; both existing order totals remained unchanged and inventory remained at 54 units. Do not reprice old orders using the new shipping fee.
- Checkout creation and status functions are redeployed with the AED 10 rule. Stripe receives a separate fixed AED 10 shipping option, so product promotion codes do not waive delivery. Request-body totals and shipping overrides are ignored.
- Cart, sticky-cart and checkout totals include delivery once per non-empty order. Admin displays the saved subtotal, shipping, promotion discount and total. The public setup endpoint reports the fee and currency; the checkout page checks these before creating a session, failing closed on deployment mismatches.
- Payment-return verification retains the cart on unpaid, failed or mismatched responses. `Check payment again` only verifies the original session; it cannot create another payment. Checkout redirects are limited to the HTTPS Stripe Checkout host.
- Automated verification passes: 39 Node tests and two Deno suites with 18 test steps, including fee tampering, promotion bounds, historical-order preservation, migration reruns, duplicate submissions and safe verification retry.
- For a future deployment, apply the shipping migration before deploying functions or the new admin/front-end queries. The base `admin-schema.sql` includes the same rule for a fresh install. Publish only the approved checkout/payment files; unrelated navigation edits stay local.

## 2. Configure Stripe Secrets

Use the selected sandbox's API key from the Stripe dashboard. Prefer a restricted test key (`rk_test_`) scoped to this integration, with Checkout Sessions read/write and promotion-code lookup access; verify the permissions with a sandbox checkout. The variable name also accepts a test secret key. The owner must create and enter the credential directly. Store credentials only in Supabase Edge Function Secrets or an ignored local environment file. Do not paste secret keys into chat, HTML, browser JavaScript or Git.

The separate `PureForm cards only` configuration is already created and saved in Supabase. Keep Cards only enabled; Link and non-card methods stay disabled. Do not change the account's Default configuration, which other integrations may use. The server checks the created session and expires it without returning a checkout URL if any non-card payment type is present.

Required custom secrets:

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Restricted sandbox/test key for Buyxyz sandbox |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the endpoint created below |
| `STRIPE_PAYMENT_METHOD_CONFIG` | Active `pmc_...` identifier for the dedicated card-only configuration |
| `SITE_URL` | The canonical HTTPS storefront origin, without a path |
| `ALLOWED_ORIGINS` | Optional comma-separated alternate storefront/local preview origins |

The example file is `supabase/functions/.env.example`. Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into hosted functions; do not create custom secrets with those reserved names.

## 3. Deploy Functions And The Webhook

Deploy the SQL before the function code. Keep JWT verification on for checkout creation and status; the webhook uses Stripe signature verification instead.

```powershell
supabase login
supabase functions deploy create-checkout-session --project-ref hibfipskhksboubibwbz
supabase functions deploy checkout-status --project-ref hibfipskhksboubibwbz
supabase functions deploy stripe-webhook --project-ref hibfipskhksboubibwbz --no-verify-jwt
```

The **sandbox** Stripe webhook endpoint already exists at:

```text
https://hibfipskhksboubibwbz.supabase.co/functions/v1/stripe-webhook
```

It subscribes to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`. Put its signing secret into Supabase as `STRIPE_WEBHOOK_SECRET`, then confirm the webhook JWT setting is off while its signature checks remain active. A failed database write must produce a non-2xx response so Stripe retries it. Reuse the existing endpoint rather than creating duplicates.

Deploy the storefront changes through the existing Git/Cloudflare workflow. The new checkout return verification requires the `checkout-status` function to be deployed first.

## 4. Verify Before Launch

Local checks:

```powershell
deno check supabase/functions/create-checkout-session/index.ts supabase/functions/checkout-status/index.ts supabase/functions/stripe-webhook/index.ts
deno test --allow-env --allow-read --allow-sys supabase/tests/
node supabase/check-backend.mjs
```

The database tests run real PostgreSQL SQL inside temporary in-memory PGlite, with a minimal Supabase-auth fixture. They do not connect to the owner's database or prove production deployment.

Complete these sandbox checks on the deployed storefront:

- Buy each set in AED with UAE delivery. Use Stripe's test card `4242 4242 4242 4242` only on Stripe-hosted sandbox Checkout, with a future expiry and any three-digit security code.
- Verify the order appears in admin with the correct items and amount, then changes to confirmed/paid. The browser must verify payment with Stripe through the server before displaying success or clearing the cart.
- Decline a test payment and cancel another checkout. Neither may be marked paid. A browser cancel/back does not immediately expire the Stripe session; stock stays held until that session expires, roughly 31 minutes after creation, and the signed expiry webhook restores it.
- Retry the same webhook. Stock must not decrease twice. Reserve competing orders for the last units and verify that the second cannot start payment.
- Test tampered prices/quantities, a non-UAE address, an unsigned webhook, a forged `?payment=success` URL and an anonymous attempt to read orders.
- Ensure admin revenue excludes unpaid attempts. Staff can change fulfillment and notes but not manually mark Stripe payments as paid.

## Live Launch Gates

- Confirm the live Stripe account is activated and supports the business. Sandbox access does not prove live charge or payout eligibility. Switching modes requires explicit owner approval, a live API key, and a separate live webhook/signing secret.
- Confirm the canonical storefront URL. Two Cloudflare URLs currently serve the store.
- UAE shipping is AED 10 per order, displayed before payment. Automatic tax is not enabled; confirm the business's applicable tax treatment before live launch. Do not imply a later undisclosed charge.
- Add and verify checkout abuse protection/rate limiting before a public campaign. CORS restricts browser origins but is not authentication or bot protection.
- Handle refunds in Stripe; automatic refund synchronization is not included yet. Do not change a payment status in the database to simulate a refund. Establish reconciliation/alerts for failed webhooks and held-stock exceptions.
- Never collect or store card numbers, expiry dates or security codes in Supabase. Only provider IDs, payment state and order/delivery data belong there.

References: [Stripe fulfillment and webhook requirements](https://docs.stripe.com/checkout/fulfillment), [Supabase secrets](https://supabase.com/docs/guides/functions/secrets), [Supabase deployment](https://supabase.com/docs/guides/functions/deploy).
