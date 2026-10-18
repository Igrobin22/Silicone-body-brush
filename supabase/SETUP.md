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
- Automated verification passes: 42 Node tests and two Deno suites with 18 test steps, including fee tampering, promotion bounds, historical-order preservation, migration reruns, duplicate submissions and safe verification retry. Public catalog copy no longer uses admin inventory notes; product titles, descriptions, prices, stock and photos still follow the listings. Product and cart controls enforce the same 20-set per-color limit as the server while keeping the actual admin stock count visible.
- Hosted sandbox order `PF-261017-9B83AA` passed on 17 October: one Pink set at AED 37.80 plus AED 10 delivery, total AED 47.80. Stripe confirmed `livemode: false`, complete/paid and card-only, with AED 10 in `shipping_cost`. The deployed return page verified the payment and cleared its cart; admin showed the same subtotal, shipping and total with payment controls read-only.
- After the shipping test, fulfillment was cancelled and its single Pink unit restored with a guarded, repeat-safe update limited to that paid `stripe_sandbox` order. Its payment remains paid, not falsely refunded. SQL confirmed cancelled fulfillment, AED 10 shipping, AED 47.80 total, no stock hold and 54 units across the three sets. Do not fulfill this sandbox order.
- Published-page audit covered the homepage, collection, Grey product, About, Reviews, FAQ, Policy, Contact, Cart and Checkout at 1440px and 390px. All 20 views had no horizontal page overflow; all internal page links and section targets resolved. Mobile color filtering and desktop price sorting/stock filtering worked. This is a responsive smoke audit, not a formal performance or accessibility certification.
- For a future deployment, apply the shipping migration before deploying functions or the new admin/front-end queries. The base `admin-schema.sql` includes the same rule for a fresh install. Publish only the approved checkout/payment files; unrelated navigation edits stay local.

## Checkout Failure Safeguard: 18 October 2026

**Deployed on 18 October 2026.** Dashboard access was restored and the existing authenticated Supabase dashboard successfully deployed `create-checkout-session` with both the updated handler bundle and `payments.ts`. No schema, credential, JWT setting, permission, payment-method, delivery-fee or storefront-design changes were made. Payments remain in Buyxyz sandbox. Git pushes alone do not deploy Edge Functions.

- A lost or truncated response is retried at most once after a short delay, with the identical request body and original order UUID as the Stripe idempotency key. This is an internal transport retry, not end-to-end deduplication of separate customer submissions.
- A recognized first-attempt Stripe validation/authentication/rate-limit rejection can release stock. Network errors, server errors, idempotency conflicts, malformed responses and a rejection following an uncertain attempt cannot prove that no session was created. These paths retain the reservation and return a support message containing the order number, without claiming that no payment occurred.
- If Stripe returned a session ID but session validation or its database attachment failed, the handler attempts expiry. Stock is released only after the matching order/session is confirmed expired and unpaid. Failed or ambiguous expiry is followed by a read of the actual session. A completed, paid session is recorded through the same validated payment function used by signed webhooks, never released as a failed checkout.
- Unresolved cases produce a `checkout_reconciliation_required` function log containing order/session identifiers and a fixed reason only. They also add a review note to an unpaid order if its admin notes are still empty. Existing staff notes and settled payment fields are not overwritten. Raw gateway errors, customer details, card data and checkout URLs are not logged or copied into admin notes.
- A failed stock-release RPC is flagged with reason `stock_release_failed` rather than silently discarded. Logging a case does not itself configure an external alert or automatically resolve it.
- Regression coverage includes exact keyed retries, persistent transport failures, HTTP 5xx, idempotency conflicts, malformed responses, failed database attachment, expiry/payment races, mismatched sessions, failed payment writes and failed releases. Database tests verify that an unattached reservation can settle or expire, that retries do not deduct twice, and that expiry cannot restore a paid order's stock.
- Final local verification passed on 18 October: 56 Node tests, two Deno suites with 32 test steps, and type checks for all three function entrypoints. After deployment, all eight read-only backend checks passed. Five additional deployment probes passed: authenticated GET returned 405, approved-origin preflight returned 204, non-UAE delivery and fractional quantities returned 400, and an unapproved origin returned 403. These probes created no orders or charges and confirmed that the updated bundle starts and rejects invalid requests; they do not replace a fresh hosted sandbox payment/expiry test.

For future dashboard deployments, update both the handler bundle and `payments.ts`; the CLI packages the repository layout directly. Run the local tests below before deployment and recheck sandbox checkout/expiry afterward. A fresh hosted payment/expiry and signed-in admin retest remains outstanding after this release. Do not fault-inject a live gateway or create live charges to test this safeguard.

### Reconcile A Flagged Order

1. Find the exact order number/UUID from the admin note or function log. In the selected Stripe sandbox, check the session metadata/client reference and request logs; the creation idempotency key is the order UUID. If attachment failed, the session may exist only in Stripe and not yet in `payment_session_id`.
2. For a completed paid session, replay its signed completed webhook or use the existing verified status endpoint with that session and order number. Confirm paid state and the saved amount in admin. Never manually set a database payment status to simulate a payment.
3. For an open session, keep its stock reserved until confirmed expiry, or expire that exact session in Stripe and verify the signed expiry event restores stock once. A browser cancel, timeout, elapsed hold duration or missing session in an initial search is not proof of expiry or non-creation.
4. If the provider confirms no session was created, or confirms an expired unpaid session whose release failed, an authorized backend operator can retry `release_site_order` for that exact order. Never bulk-release all unpaid/old orders. The function preserves paid orders, but unknown outcomes still require provider reconciliation first.
5. Record the verified outcome in admin notes after resolution. If Stripe or the database remains unavailable, retain the reservation and escalate the log. Configure alerts and a reliable operational reconciliation process before accepting real orders. Automatic refund synchronization and checkout abuse protection remain separate launch gates.

This follows [Stripe's guidance on indeterminate errors and keyed retries](https://docs.stripe.com/error-low-level).

## Storefront Audit: 18 October 2026

**Deployment boundary.** Storefront fixes publish through the existing Git/Cloudflare workflow; the Edge Function safeguard above was deployed separately through Supabase on 18 October. The HTTP audit below predates publication of these storefront fixes and does not confirm their release. Existing hero, fonts, colors, navigation edits and the separate clean checkout folder are preserved. Browser access was unavailable during this HTTP audit and was later restored for deployment. This audit does not claim a new desktop/mobile render, authenticated-admin inspection or hosted payment test.

- The published HTTP/HTML audit checked 15 main routes, 30 linked document URLs and 53 HTML/catalog asset URLs. All returned successfully, the checked same-site section targets existed, informative images had alt attributes, and checked inline classic scripts parsed. This does not execute browser interactions, inspect CSS-only assets, verify image rendering, measure Core Web Vitals or prove email delivery.
- All eight read-only backend checks pass, including public canonical listings, AED 10 fee agreement, denied anonymous order reads, checkout JWT checks and the signed-webhook route. Published available inventory is Grey 24, Black 18 and Pink 12. None is below a proposed low-stock threshold of five. Confirm physical counts before using scarcity claims.
- Cart regression tests reproduced two bugs: an add/increase could reduce an existing quantity after available stock fell, and decreases could be ignored when stock was reserved. The local fix preserves existing cart intent on blocked increases and permits explicit reductions/removal. Quantity fields remain valid for the saved quantity while the increase button respects current stock and the 20-set cap.
- Local checkout disables creation for known unavailable quantities and shows an availability warning. Forced submissions are also rejected before API calls. This is a customer-facing check, not a replacement for server-side reservations. Verification of an existing payment still works while its units are reserved.
- A verified old payment-return link previously cleared any current cart. The local fix stores only the submitted order number and item quantities in tab-scoped session storage before redirect, then clears only a matching, unchanged cart after server payment verification. The snapshot is consumed before clearing; changed carts, callbacks without a matching snapshot, and unavailable/damaged storage preserve the cart without mislabeling a confirmed payment. No card or delivery/contact details are stored in this snapshot.
- Three original Grey photo URLs served files of 2,899,245, 2,843,844 and 8,669,224 bytes. Local catalog normalization now requests bounded, non-cropped Cloudinary delivery for plain versioned uploads only. Measured WebP responses were 98,172, 78,960 and 127,744 bytes (96.61%, 97.22% and 98.53% smaller). All three optimized images returned successfully and were visually inspected. These are image transfer savings, not whole-page speed or Core Web Vitals results. Admin originals, existing transformations, signed/query-bearing URLs and other image hosts are unchanged.
- Current local regression verification passes 56 Node tests and two Deno suites with 32 backend test steps. Future and expired fixed-date catalog discounts are tested in both public pricing and gateway pricing. Existing published offers are ongoing, with no end dates: no urgency campaign or countdown was activated.
- The contact form uses `mailto:hello@pureform.ae` and depends on a configured email application; it does not save support requests or send them through a backend. Inbox ownership/delivery was not verified. A Grey scalp image also contains a "Hair Growth" claim; supporting product-specific evidence was not verified during this technical audit.
- Before real customer traffic, repeat hosted sandbox purchase/expiry and signed-in admin checks after this release, enable live payments only with explicit owner approval, and resolve the remaining abuse-protection, refund/reconciliation, email and claim-verification launch gates. Proposed promotions require real dates, stock/gift allocation and approved economics; the approved standard delivery fee remains AED 10.

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
