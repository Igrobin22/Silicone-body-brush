# PureForm shipping preparation

The Supabase queue and Telegram commands are deployed. This Windows tool
prepares Shiplifier's first order page for owner review, with C3X preferred.
It does **not** save the customer pin, press Next or Submit Order, select/pay
for a courier, purchase a label, recharge the wallet or request collection.
The storefront remains static HTML/CSS/JavaScript. This separate local tool
uses pinned Playwright 1.64.1 and installed Chrome with its browser sandbox on.

## Everyday use

Double-click `start-shipping.cmd` in this directory. Keep its terminal and
separate Chrome window open. In your private chat with **@Pureforbot**, send:

- /shipping` — see the actual queue counts.
- /process_all` — prepare currently waiting eligible orders.

The tool checks the requested queue about every 30 seconds. When the laptop
is off, orders remain in Supabase. No Windows startup task or background service
is installed. Closing the shipping Chrome window stops the listener.

The prepared customer-address dialog stays open. Check the customer's country,
emirate, full address, exact map pin and contact information in Shiplifier.
Review the courier and its actual price yourself before any booking. Once an
actual booking exists, record its SM shipment ID and C3X tracking number in the
website admin order. This records tracking; it does not mark the parcel shipped.
Change fulfillment when the courier actually collects it.

Only newly confirmed **live paid Stripe orders** are eligible. Sandbox, unpaid,
cancelled, shipped and refund-affected orders are excluded. No historical orders
are backfilled. The current website's sandbox mode therefore produces no jobs.

## Preparation and duplicate protection

The owner-only request authorizes the currently waiting orders for 24 hours.
Future orders require another command. Unique order jobs, bounded claims and
10-minute leases prevent simultaneous preparation. A lost/expired lease goes to
Needs review instead of automatically repeating a potentially completed action.

The tool fills the saved order reference, delivery instructions, actual
per-item selling price, quantity, dimensions, weight, AED and COD=No. It saves
only the previously verified sender/pickup business-address dialogs, checking
their visible map coordinates against the private profile. Customer location
is never inferred from a generic city pin. The queue records **Needs review**,
not Created, and notifies the owner.

After interruption, check Shiplifier for an existing shipment. Use **Retry form
preparation** in admin only after confirming there was no booking, then send
/process_all` again. Admin saves reject stale edits. The laptop credential
cannot retry jobs, mark an order paid or record a created shipment.

## Verified setup and limits

On 5 November 2026, the owner confirmed Bay Square as both sender and pickup,
and one packed set at **13 × 13 × 35 cm, 0.8 kg**. Full business contact details
and the inspected exact building pin are stored privately outside this repo.

One product row and a one-set packing profile are mapped. Mixed-color orders or
larger quantities need measured packing profiles; the tool will not multiply
dimensions. Missing customer email also requires manual preparation because
Shiplifier requires email while checkout permits phone-only contact. No customer
email is replaced by the owner's address.

A live form test using only the owner's own business contact details passed
sender/pickup map checks, package fields, AED and COD=No. The separate activation
test reached the quote step without choosing a courier or submitting an order.
It created no website order, label, shipment or collection. The final courier
quote was not independently verified before browser control stopped. A previous
Dubai–Dubai quote showed C3X at AED 17, but that is not a guaranteed current rate
or spending authorization. Full automatic booking and tracking capture remain
unimplemented; the current owner instruction is to test without placing orders.

## Backend deployment

Completed in project `hibfipskhksboubibwbz`:

1. `20261105000100_shipping_queue.sql` creates the private queue, run requests,
   restricted worker verifier and admin tracking/retry operations.
2. `shipping-worker` v2 and `telegram-bot` v2 are deployed. Mandatory dedicated
   header authentication remains inside these functions. Checkout and signed
   Stripe webhook deployments/settings were not changed.
3. A fresh 256-bit random laptop key is Windows-account encrypted in
   `%LOCALAPPDATA%PureFormShippingcredentials.xml`. Only its SHA-256 verifier
   is registered in the service-only `site_shipping_worker_auth` table. No
   `SHIPPING_WORKER_SECRET` Edge Secret is required.
4. Authenticated laptop ping succeeded. Anonymous and wrong-key worker calls
   and unsigned Telegram calls were rejected. The private queue has zero jobs.
5. The audit's separate `20261105000200_private_payment_functions.sql` explicitly
   removes direct public-role grants from six backend-only payment functions.
   The service role retains access; actual order/payment data was not changed.

The admin release includes both HTML routes, `assets/pureform-admin.js` and the
shipping-specific workspace spacing. Controls appear for queued eligible orders
and remain hidden if the queue/backend is unavailable or an order is ineligible.

## Reinstall or repair the laptop

From this directory run `npm.cmd ci` to install the locked dependency. No
browser download is needed. From the repository root:

```powershell
powershell.exe -NoProfile -File .\tools\shipping-worker\setup.ps1
powershell.exe -NoProfile -File .\tools\shipping-worker\start.ps1 -Mode login
powershell.exe -NoProfile -File .\tools\shipping-worker\start.ps1 -Mode verify
```

Setup preserves an existing key, or generates a fresh one and encrypts it with
Windows DPAPI. The private folder allows only the Windows owner and SYSTEM.
It prints only the non-secret SHA-256 verifier, which must be registered by an
authorized backend administrator when creating or rotating the worker key.
Never reuse a Telegram, Stripe or Supabase service credential.

The private `profile.json` and persistent Chrome profile live in the same private
directory. Sign in personally in this separate browser; the tool never copies
your everyday Chrome cookies or asks for a password in chat. New installations
must fill and verify business-address/contact/map fields from the example.
No credentials, customer data or browser sessions belong in the website folder.

Other modes:

- `-Mode check`: confirm the local profile exists, with no backend request.
- `-Mode verify`: authenticate to the deployed ping; no order is read or changed.
- `-Mode prepare`: process at most five owner-requested jobs, rather than listen.
- Default `watch`: wait for requests until the shipping browser closes.

## Verification

`npm.cmd test` exercises order validation, credential destination restrictions,
unknown packing, exact verified business pins, customer-review boundaries and
graceful listener shutdown. Its Chrome form fixture blocks external requests
and asserts that customer Save Details and Next are never clicked.

Supabase tests use local PostgreSQL/PGlite for queue/RLS/lease/refund/tracking
authorization, and mocked databases for Edge Function/bot routing. The admin
browser audit uses synthetic orders with external backend writes blocked.
Those local tests complement, rather than replace, the deployed checks above.
