---
version: alpha
name: PureForm Spa Minimal
description: A soft, hygienic product-commerce design system for the PureForm silicone body brush website.
colors:
  primary: "#111111"
  secondary: "#666660"
  muted: "#AAA9A4"
  surface: "#FFFFFF"
  surface-soft: "#F8F8F6"
  surface-muted: "#EEEEEC"
  border: "#E8E9E6"
  wash: "#E7F0F0"
  sage: "#DBE5DF"
  rose: "#F6DBE4"
  mint: "#DCEEE7"
  gold: "#EADFC4"
typography:
  display:
    fontFamily: Montserrat
    fontSize: 56px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: 0em
  headline:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0em
  body:
    fontFamily: Open Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: 0em
  label:
    fontFamily: Open Sans
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0em
  button:
    fontFamily: Open Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0em
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  section: 80px
  nav-height: 72px
  page-gutter: 80px
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 28px
  full: 9999px
components:
  nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    height: 72px
    padding: 24px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 12px
  product-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 24px
  section-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 20px
---

# PureForm DESIGN.md

## Overview

PureForm should feel calm, premium, hygienic, and product-led. The site is a boutique ecommerce experience for silicone bath tools, so the visual tone should stay clean and sensory rather than loud or gadget-like.

The design personality is soft spa minimalism: white space, delicate glass-like panels, restrained black typography, subtle mint/rose washes, and large product imagery that lets the brush forms do the selling. Every page should feel like part of one skincare-adjacent ritual, not a generic dropshipping storefront.

## Colors

Use high-contrast neutrals as the backbone. `primary` is near-black for headings, nav, prices, and the main action. `secondary` and `muted` carry body copy, captions, metadata, and secondary navigation.

The supporting palette uses softened bath and skincare tones: `wash`, `sage`, `mint`, `rose`, and `gold`. These colors should appear as atmospheric gradients, small accents, swatches, or background washes. Keep them pale and spacious; do not turn them into saturated brand blocks.

White and off-white surfaces are essential. Prefer `surface`, `surface-soft`, and light borders for content structure before adding heavy color.

Use secondary grey (#666660) for small storefront captions, crossed-out prices, helper text and section labels on white or off-white. The pale muted swatch is for decorative treatments, not small readable text. Admin sign-in labels use the workspace grey (#59635e). Keep text contrast at least 4.5:1 without changing the palette or hero composition.

## Typography

Use Montserrat for the PureForm wordmark, hero, section headings, and product titles. Use regular to medium weights (400 to 500) for a familiar, clean storefront feel, with enough line height for multi-line headings.

Use Open Sans for navigation, body copy, product facts, forms, buttons, and utility labels. Body copy uses regular weight (400), usually 13px to 15px with comfortable line height; controls and important details can use 500 to 600. Larger price totals may use Montserrat to match nearby headings.

Use normal letter spacing (0) throughout. Labels and eyebrows may be uppercase, used sparingly to create quiet hierarchy.

Load the same Montserrat and Open Sans Google Fonts request on every storefront and admin page, with `display=swap` and preconnections to the font hosts. Use Arial and the browser sans-serif as fallbacks. Normalize fallback size with `font-size-adjust: from-font` where supported; older browsers retain the normal fallback stack.

On tall phone screens, give each phrase in the homepage headline its own line.
Use Montserrat for “Soft touch.”, a larger Instrument Serif italic for “Deep
clean.”, and a quiet Open Sans closing line for “Every day.” Keep all three in
charcoal. The serif accent is limited to the mobile hero. Keep the headline in
the upper left so the tools and canopy have room, and use the compact heading
layout on short screens. Set the selected color in Montserrat beside smaller
set details, above the primary action and a restrained row of product facts.

## Layout

Lead with product imagery. The homepage hero uses the owner's floating colour studio edge to edge, with no outer spacing, border, rounded frame, white wash, gradient overlay or background mask. Fit its height to the opening viewport beneath the actual 106px desktop or 72px mobile header, so all four tools and the colour buttons are visible immediately. Preserve the 1620:971 product artboard and every brush's natural proportions; never stretch a photo to fill the hero. Desktop uses a horizontally outpainted panoramic version of the empty background, with proportional cover sizing. Phones retain the original background with proportional cropping. Keep the arch and pedestal stationary, brushes gently floating and leaves swaying. On desktop, place the original "Soft touch. Deep clean. Every day." headline and description near the middle left. Constrain the copy and purchase group to the outer desktop columns so the centre stays open for the products. Limit the desktop scene height relative to its width to preserve space beside the arch on tall windows. Put the selected set label and shopping buttons in the right column, with set facts below on taller screens. Use the display font for the label and show prices in the collection and product pages. Stack the buttons within that column on narrower desktops. Compact windows simplify supporting copy and facts. Move the desktop canopy to the top-right to keep text clear without obscuring the photograph. Place Grey / Black / Pink buttons over the bottom of the scene and a quiet pause control in its upper-right corner. The selected colour supplies the label and the admin-backed Shop the Set destination; unavailable or hidden colours link to the collection instead. Phones place the headline over the top of the scene, all four tools below it, colour buttons inside the bottom edge, and a compact purchase panel below the image. Center the selected set label and Shop the Set button above one divided row of four facts. Omit the studio caption on mobile and the hero review shortcut. Keep delivery, card payment and support links in a quiet strip beneath the facts. Colour switching preserves scale, position and the motion timeline. Keep the neutral, mint and rose brand system.

Use one homepage collection, followed by the four included tools, a compact lifestyle photo row, customer notes, and practical delivery/payment/support questions. Avoid repeating the same three products or displaying unconfigured promotion codes. Section layouts are unframed, with restrained borders and shared horizontal gutters.

Continue the studio backdrop below the hero through the service links and the three homepage product cards. Render the proportional hero photo and its floor extension in soft grey, and blend the extension into a neutral surface. Keep the tools and foliage in their original colors and the product cards white. End the backdrop before the combo offer.

Public storefront copy omits return and refund terms at the owner's request. Remove those references from product buying areas, FAQs, policy sections, footer links, support topics and metadata. Use general order support and product-care links instead; do not replace removed wording with an all-sales-final or no-returns claim. Keep internal gateway payment and refund accounting intact. Show the current selling price on cards and product pages. Leave crossed-out prices, percentage badges and sale announcements off the storefront until the former prices and applicable promotion licence are confirmed. Keep admin pricing, expiry and checkout calculation authoritative. The header message identifies UAE delivery and card-only payment. Keep the existing header dimensions, typography, mobile visibility and quiet motion unchanged.

The lifestyle row uses three reference-based AI-styled scenes: the Grey set beside a basin, the Grey body brush being rinsed and the Pink set on a shower shelf. Keep it separate from customer reviews and admin-managed catalog photography; do not imply a verified purchase or use these images as product evidence. A quiet disclosure identifies styled scenes and notes that bathroom accessories are not included. Use complete square photos without cropping, three columns on desktop and a native keyboard-scrollable strip on mobile with a hint of the next photo. Caption links open the matching color. Deliver local 600px and 1200px WebP sources with explicit dimensions, lazy loading and asynchronous decoding; do not change the original hero or load new image libraries.

The rest of the storefront uses a consistent retail structure, inspired by the reference retailer's information hierarchy rather than its branding. Preserve the homepage hero markup and appearance. Use a shared 1360px outer width with 40px desktop and 20px mobile gutters, compact breadcrumbs, literal page titles and white, divided content areas. Collection cards keep contained square photos, catalog prices and functional filters. Cart and checkout show visible titles, a Cart / Delivery / Card payment progress indicator, and readable summaries without nested cards. FAQ groups use native disclosures with topic links; policies use a table of contents and flat reading sections. Support offers email, Telegram, practical help links and the existing email-draft form. Do not show fixed bundle prices in support forms. Use the shared four-column footer outside checkout, with two columns on mobile. At checkout, show the wordmark and a cart link in the header and keep only support, delivery, privacy and terms links in the footer. Do not introduce memberships, extra product categories, invented guarantees or unconfigured offers.

The shared header is sticky: 106px on desktop including the announcement, and 72px on mobile. Main navigation is Home, Shop, About, then Policies & FAQ, in that order. Reviews stay linked from the homepage, product pages and storefront footer. Do not include The set or separate Policy and FAQ menu items. Use the same destinations and current-page state in the mobile menu, with support and the cart accessible. Combine all FAQ topics and policy text on policy.html, retaining delivery, privacy, support and FAQ fragment links. The old faq.html address redirects there and preserves its fragment. Keep the included-tools content and homepage hero unchanged. Avoid adding duplicate top padding beneath the sticky header.

Desktop navigation follows the supplied tabs reference: one 6px-radius translucent grey highlight slides between hovered or focused links over 300ms, with a thin black current-page underline. Use actual anchors and aria-current, not tab roles or a default Home selection. Match measurements after fonts load and on resize; keep labels stationary, touch areas 44px high and tablet spacing compact. The underline has its own native view-transition name so it moves between actual pages while the header stays still. Reduced motion keeps both decorations static. Adapt the reference in the existing vanilla JavaScript/CSS, with no framework or new dependencies. Keep the current modal drawer on mobile.

Desktop product grids use three columns for the three listings. Mobile product grids use two columns, with readable names, prices, stock/offer labels, and square inspectable imagery. Color, in-stock and price-sort controls must update the displayed catalog and product count.

Product pages follow a retail product-detail structure: breadcrumbs, an inspectable gallery on the left and a compact purchase area on the right. Keep the product title, link to customer reviews, catalog-backed selling price, color links, delivery, quantity and Add to cart together. Wrap the section links on mobile. Use flat dividers rather than nested purchase cards. The gallery has photo thumbnails and a native modal for enlargement, with contained images and horizontal swipe at every width. Below the purchase area, use a restrained service strip and anchor links to product details, specifications, delivery/payment and existing photo reviews; related colors follow those sections. Details use native disclosures and a compact key/value specification list. Mobile stacks the gallery before the purchase information, with 16px quantity text and touch-sized controls. A mobile purchase bar appears after the main buying action scrolls out of view and uses the same cart behavior and stock checks. Preserve PureForm's fonts, palette and actual policies rather than borrowing another retailer's brand or promises.

Keep delivery questions close to the buying controls. Offer a touch-sized link to the existing support form with Delivery preselected so shoppers with a deadline can ask before paying; do not invent arrival estimates. The 1 + 1 combo must explicitly say both sets are paid for and the AED 10 saving is on UAE delivery, with no code required.

The owner-confirmed UAE delivery estimate is 2–3 working days. Show it consistently in home FAQs, collection delivery information, available-product status and delivery details, cart summary, checkout shipping method, support and policies. Keep it an estimate rather than a guaranteed arrival date. Preserve it when checkout updates for a city or cart change; unavailable products show restock guidance instead. Keep AED 10 delivery for one set and free delivery for two or more sets. Date-sensitive customers can still ask support before paying.

Switch colors within the product page. Keep the color picker in place while updating the catalog details, gallery and purchase controls together. Keep shareable color links and restore the selected color with browser Back and Forward.

On mobile checkout, show a compact expandable order summary with the current total above the contact and delivery fields. Keep the full summary visible beside the form on desktop.

Use 16px input, select and textarea text on mobile and tablet widths through 1000px, including product quantities, collection sorting, combo selectors and discount codes, to keep forms readable and avoid focus zoom on iOS. Desktop form sizes stay compact.

Show AED 10 UAE delivery for one set and free UAE delivery for two or more sets, separately from the product subtotal in cart, sticky-cart and checkout. Checkout asks for an email address, one delivery phone, an emirate and an area or city. Keep the optional coupon field inside a native disclosure. Shipping is charged once per order, never per set, and is zero for an empty cart. The server calculates eligibility from validated quantities, including matching colors. Stripe verifies payments before the return page clears a cart; verification failures retain the cart and offer a payment-status retry without creating another checkout.

Keep cart rows and quantity controls stable during edits and catalog refreshes, preserving keyboard focus and unfinished input. Synchronize cart and checkout summaries across tabs and restored history pages without writing storage events back in a loop. Saved items hidden by admin stay reviewable and removable, clearly unavailable with checkout blocked; never replace an empty admin catalog with purchasable fallback stock.

With exactly one available set in the cart, show a compact quantity-based delivery progress line and a second-set chooser immediately below the items. Use three visible native radio choices with actual catalog photos and AED prices, omit unavailable options, and preview the complete new total before adding. Add exactly one set without leaving the cart. At two or more sets, replace the chooser with a quiet free-delivery confirmation; never keep upselling after qualification. Verify the deployed shipping rule and fresh catalog before displaying this enhancement, and preserve keyboard focus as it collapses. Hide the mobile floating checkout bar while the picker is in view. Exclude colors already in the cart from the separate recommendations. This is the existing AED 10 delivery waiver, not a free second product or an additional discount.

Product quantity changes show a selected-sets subtotal above Add to cart; shipping remains separately explained. Refresh prices, discount labels and structured data from the same admin catalog without resetting gallery position. Do not claim VAT is included until the business's tax treatment is confirmed; describe the set price and separately displayed delivery charge. Missing or hidden listings are unavailable, and adding must succeed in full rather than silently reducing the requested quantity. Include a native Use & care disclosure with three short, numbered steps and no medical promises. Match each tool label to its actual photograph, regardless of legacy asset filenames; the tool overview shows all four reference pieces in Grey, including the hexagonal face brush from the approved studio scene, and explicitly notes that a purchased set contains one selected color.

Open a linked product disclosure on direct entry and fragment changes without forcing document scrolling. Use the existing reduced-motion-aware rise reveal on routine steps; cart offers, prices and add actions remain stationary. Reference patterns reviewed: [OSEA's product and contextual delivery structure](https://oseamalibu.com/products/bodycare-bestsellers-set), [Blueland's explicit set contents](https://www.blueland.com/products/laundry-starter-set), and Baymard's research on [buy-area shipping clarity](https://baymard.com/research-articles/avoid-banners-only-free-shipping) and [relevant cart offers](https://baymard.com/research-articles/product-recommendations-cart). These inform hierarchy, not copied branding, reviews or product claims.

Use a compact 1 + 1 combo offer below the catalog and product purchase area, with two selectable colors, actual product photos and current admin-backed prices. The offer is two paid sets with free delivery, saving AED 10; never imply a free second set or apply another AED 10 product discount. Show the offer only when the deployed checkout confirms its delivery rule. Keep the original hero unchanged. Public listing and product status lines may show positive paid sales counts. Call out remaining stock only when live inventory is between one and four sets. Count only paid, non-cancelled, non-refunded live Stripe orders, never sandbox activity. Refresh actual stock quietly without restarting galleries or section animations. Do not fabricate shoppers, sales, countdowns or visitor-specific stock depletion; hide unavailable metrics instead.

For local design testing only, `?demo=activity` may add separately labeled Demo data below the real product figures. Enable it only on loopback hosts, never public domains or checkout/admin pages. Sample viewers, sold counts and stock are read-only fixtures with a persistent preview clock, explicit pause/reset/exit controls and a reduced-motion pause. They must not change the catalog, cart, structured data, backend or checkout, or replace real metrics. The original hero is unchanged.

Reserve large display typography for the homepage hero. Information-page titles use 40px on desktop and 28px on mobile; section headings use 32px and 26px. Checkout headings remain at 24px to 26px. Supporting hero images are capped at 260px on desktop and 180px on mobile, and customer photos at 200px to 220px. Main product galleries and collection imagery remain large enough to inspect.

Use section padding around 5rem on desktop and reduce gradually on mobile. Keep repeated product and review cards on predictable grids with stable dimensions so hover states do not shift the layout.

The product-detail gallery's main image is bounded by the opening viewport,
reserving space beneath the header and breadcrumb for the thumbnail row and
caption. Show the complete photo with contained sizing, and keep enlargement
available. On phones, reserve space for the smaller thumbnail row without a
caption. Resizing the window must preserve the visible gallery controls.

## Elevation & Depth

Depth should be quiet. Use thin borders, translucent white surfaces, soft shadows, and occasional backdrop blur for glass-like panels. Shadows should be broad and low-opacity, never harsh.

Product images can carry stronger drop shadows because they are the visual focus. Content panels should rely more on border, wash, and spacing than on stacked card depth.

## Shapes

The shape language is soft but controlled. Buttons and pill badges use fully rounded corners. Cards and panels use 8px to 24px radii depending on scale. Large hero panels can reach 28px when they need a plush, spa-like feel.

Avoid mixing sharp boxes with highly rounded controls in the same cluster. Keep product media containers, cards, and copy panels visually related.

## Components

### Opening Intro

On the first eligible homepage visit in a tab, show the four Grey tools over a pure white (#FFFFFF) background. Fill the surrounding space with two thin elliptical rings, two pale sage discs, curved contour lines and three small drifting dots. Keep this decoration behind the tools, animate it with restrained transform and opacity tracks, and fade it away before the hero handoff. Adapt the composition to portrait screens; all shapes remain decorative and leave with the overlay. Omit intro copy, wordmarks, tinted gradients, decorative arches and light effects. Keep all four tools Grey throughout the intro, using the same decoded layers as the hero. Lead with the back brush, then the body pad, scalp massager and face pad at 90ms intervals. Each follows its own shallow rising arc into the set, at its measured hero size, with only 5–7 degrees of starting tilt. Keep both axes progressing towards the target, without loops, reversals or intersecting routes. Sample paths by distance so bends do not cause changes in speed. Use one cubic-bezier(0.22, 1, 0.36, 1) ease-out over 1720ms; do not add repeated speed ramps, pauses, overshoot or a second launch before landing. End at the exact measured hero position and angle. Begin fading the white backdrop during the flight to reveal the existing hero and its text without changing product colors. Keep the page width stable while scrolling is locked. Keep the hero's motion paused during the handoff and resume its existing floating loop on Grey. The hero has manual color selection. Preload and decode the layers before motion, allow 2.5 seconds for readiness, and release the page if the artwork is unavailable. Use transform and opacity tracks through the Web Animations API. Recompute the targets on resize. Skip is a keyboard-accessible control outside the decorative layer. Respect reduced motion, use the pf_intro_seen session marker, and allow ?intro=1 to replay the intro. The intro applies only to the homepage and preserves direct section links.

Motion references reviewed on 18 November 2026: [Material choreography](https://m1.material.io/motion/choreography.html) for a clear focal direction and continuity, [duration and easing](https://m1.material.io/motion/duration-easing.html) for decelerating entrances, and [Codrops' product-grid reveal](https://tympanus.net/codrops/2025/09/01/recreating-palmers-draggable-product-grid-with-gsap/) for staggered product staging. Adapt the principles to the existing Web Animations API; retain the product scale and current hero layout.

### Page Transitions

Use native same-origin cross-document view transitions for storefront navigation: a quiet 240ms incoming dissolve over a fully opaque outgoing page, with the shared header and mobile menu toggle kept visually stationary. Never fade both snapshots away together, which exposes white between pages. Keep menu labels stationary while their highlight and underline move. Do not delay clicks, replace native links/history with a client router, blur the page, or animate the entire body. Wait for the main content markup before capturing the destination and exclude closing mobile drawers from outgoing snapshots. Settle visible content before the incoming capture by disabling its section keyframes and resetting translate/scale; normal reveals remain below the fold. Unsupported browsers and file previews use only a near-opaque 160ms content settle, never a fade from blank. Reduced-motion users get instant transitions. Keep admin/authentication pages and external card checkout outside this storefront enhancement.

### Section Motion

Use the existing store-flow Intersection Observer for six restrained entrance styles: fade, rise, drop, left/right slide and soft zoom. Page titles drop in; product rows rise with short staggered delays; tool images gently scale in; customer reviews slide in; FAQ headings, question rows and policy sections use complementary directions. Preserve the hero's artwork, layout and controls; only its headline and supporting paragraph receive a light text entrance. Never animate whole sticky containers, live cart rows, prices, quantity controls, checkout fields or payment actions. Keep entrance movement within 24px, scale at 0.96 or above, duration around 520ms and stagger delays capped at 165ms. Use independent translate/scale properties so hover transforms remain stable. Avoid permanent will-change layers, blur, bouncing and continuous motion outside the restored hero soap bubbles.

The approved floating studio replaces the former hero photograph and bubble layer. Keep floating and swaying within the product and leaf layers; the backdrop receives only the scroll depth described below. Controls sit outside the artwork's image role, never inside an aria-hidden layer. A 44px pause/resume icon sits in the image's upper-right corner. Pause motion while offscreen, in a background tab or during page exit; disable it for reduced motion and when observers are unavailable. On mobile, crop decorative side space rather than clipping a product. Keep the scene and copy in normal flow, without fixed top-padding offsets or text overlap. Keep the original headline, fonts and shopping behavior. Do not load both old and new animation controllers.

Use clearly visible homepage parallax with native CSS scroll timelines. Keep
the opening hero composition exact at scroll zero, then separate the layers
from the first scroll. Across one image-height of root scrolling, the backdrop
counters the scroll by 72px, the product plane moves 100px faster than the
page, and the canopy moves 220px faster. Retain the existing float and sway on their
child layers. Keep the three pedestal shadows outside the moving product plane.
Their artboard follows the backdrop exactly, so shadows remain fixed on the
pedestal; disable their scale and opacity breathing animation. Product movement
is relative to that ground plane. The backdrop stays proportionally sized; its exposed top lies
above the sticky header, and its lower edge stays clipped within the scene.
Keep text and buying controls on their normal page plane. Use 24–36px of depth
on included-tool photos and 36–64px on desktop lifestyle photos. Preserve
every image's proportions and complete crop. Phones use 48px / -48px / -120px
for background / tools / leaves, 12–20px on tool photos, and retain the normal
horizontal lifestyle strip. The hero motion control pauses the scroll effects
too. Disable parallax during the intro and for reduced motion; browsers without
both scroll timelines and animation ranges retain the normal layout. Do not
add scroll listeners, fixed backgrounds, image zoom, extra dependencies, or
movement to catalog prices, reviews, forms or checkout.

Catalog changes register with the same observer, but already-seen product rows update instantly instead of replaying. Keyboard focus reveals content immediately and cancels its entrance. A reduced-motion change and back/forward-cache restore show all pending content instantly. Missing observers fail open; JavaScript-disabled pages remain readable. Keep admin, recovery and redirect pages outside this decorative motion.

When a native page transition starts before deferred section setup has finished, settle any later-registered first-viewport targets immediately. Never hide already-painted headings or copy to replay an entrance after the page dissolve. Keep below-fold section motion intact.

Use the Atelier North reference's eased wheel scrolling on public storefront
pages, with the locally served Lenis 1.3.26 distribution, a 1.2-second duration
and cubic ease-out. Keep touch input native and skip smoothing for reduced
motion. Pause page scrolling for the opening intro, mobile navigation and
modal dialogs. Nested scroll areas, forms and keyboard navigation remain
usable. Keep CSS scroll behavior automatic so reloads, fragment destinations
and browser history restore directly. Never force a reload to the top or
replace browser history restoration. Admin keeps its normal scrolling.

Exclude animated targets and replaceable catalog grids from scroll anchoring, without turning anchoring off for the entire document. Lay out this small storefront's sections normally; do not apply generic content-visibility placeholders with guessed section heights, which shift restored positions as content renders. Keep below-fold photos lazy-loaded. Tool-photo frames use shrinkable grid tracks and bounded images, so their fixed responsive height never lets a photo overlap its label.

### Admin Orders

Keep the orders workspace compact and work-focused: 28px page headings, 20px section headings, and readable 13px to 14px table text. The order table uses the full content width; selected order details follow below it in normal page flow, without a fixed-height nested scroller. View moves focus to the selected order, and Back to orders returns to the list. On narrow screens, show each order as a labeled block with visible status, payment and actions. Mobile admin navigation wraps into two rows so every section stays visible. Use flat, divided detail fields instead of nested cards; long emails, addresses and gateway IDs wrap. Mobile form controls use 16px text. Preserve the existing fonts, neutral/mint/rose colors, authentication and read-only gateway payment state.

### Admin Workspaces

The admin is a quiet operational workspace, using the same Montserrat/Open Sans wordmark and fonts with white/neutral surfaces, thin borders, restrained mint selection states and amber/red semantic statuses. Avoid storefront-style glass panels, atmospheric gradients, oversized headings and floating page-section cards. Use a 216px desktop sidebar, a compact title/action header, 6px command controls and an icon/text navigation row on mobile. Keep authentication and recovery secure, with a compact sign-in form and the existing recovery link.

Use seven actual store metrics in a flat overview strip, followed by divided inventory, discounts and recent-order lists. Each overview row opens its actual record. Do not add fabricated charts, visitor counts, comparisons or a Today label to lifetime/loaded-order metrics. Keep sandbox orders excluded from revenue and identifiable in the order list; payment statuses remain gateway-controlled and read-only.

All admin listing and content workspaces use one full-width column: search/filters and the complete list first, then an editor in normal document flow only when Edit/Add or an explicit record URL is selected. Do not create horizontally scrolling table boxes, fixed-height detail panels or sticky editors. At narrow container widths, show each record as a labeled block with all fields and actions visible. Edit/Add moves focus to the editor heading; Back to listings/content returns to the list. Keep tables semantic, long text wrapped and editing controls at least 44px tall.

Orders support local keyword, payment and customer/sandbox filters alongside the existing status views. Products support keyword/visibility/stock filters and local name/stock/price sorting; admin sorting never changes storefront order. Content supports key/label search. Show actual result counts, a clear-filter action and meaningful empty states. Preserve input focus while filtering; do not send search text to third parties.

Group product editing into native fieldsets for details, pricing/discounts, inventory/visibility and media. Display photo previews in a responsive grid, retaining first-image order and explicit move/remove controls. Ongoing discounts disable date controls. Show unsaved edits, confirm before discarding, prevent double submissions and preserve fields on save failure. Match the original product updated_at on full-record saves to reject stale inventory edits. Session loss always hides private data and returns to sign-in without being blocked by unsaved-form warnings. No backend role, RLS, payment or checkout changes belong to this visual redesign.

Reference patterns reviewed on 24 October 2026: [Shopify product search/filter workflows](https://help.shopify.com/en/manual/products/searching-filtering), [Shopify's single-column resource layouts](https://shopify.dev/docs/apps/design/layout), and [WooCommerce order lists and status filters](https://woocommerce.com/document/managing-orders/overview-and-bulk-management/). These inform task hierarchy, not a platform migration or copied branding. Adapt them using existing vanilla JavaScript, HTML and CSS only.

Admin order details may include a C3X delivery fieldset below the existing order
form. Use normal document flow, the existing editor-section styles and labeled
tracking inputs, with no inner scrolling. Show actual queue status and plain
reasons when preparation needs review. Recording an existing Shiplifier booking
must not alter gateway payment or mark the parcel shipped. Keep created tracking
read-only; retry preparation only after an explicit owner check for duplicates.
Hide these controls gracefully when the separate shipping backend is unavailable.

### Product Photos

Provide a Photos workspace in admin. Group saved listing photos in
display order, starting with the main photo. List earlier Cloudinary photos
separately when their links are not already shown in a listing. Use small,
contained previews with readable full URLs and a Copy link button. Keep URLs
wrapping within the content column on phones.

Use a native dialog with thumbnails and search to choose an existing photo for
a listing or website image position. Keep selections as an unsaved draft until
Save listing or Save content succeeds. Keep Photos dedicated to photo previews
and links. List website positions on the separate Image editor admin page.
Preserve separate desktop/mobile backgrounds
and each hero color layer. Native dialog dismissal restores keyboard focus.

Keep each product gallery in its selected color, including tool-detail photos and failed-image fallbacks. Static homepage, collection and cart recommendation cards and cart fallbacks use the existing matching assets/products/{color}-main.webp full sets with explicit dimensions; never start a large original PNG download or show a differently colored tool while the catalog loads. The owner-supplied galleries dated 24 October 2026 contain Grey 5, Black 7 and Pink 9 photos. Preserve original URLs and their order in admin; the first photo supplies the main product image. Optimize public Cloudinary delivery without cropping or changing the products. Future admin changes remain authoritative.

The admin photo editor uses contained previews, a Main photo label, explicit 44px up/down/remove controls, upload and add-link icons with tooltips, and 16px URL inputs. Keep order stable during uploads; photos publish only when Save listing succeeds. Uploads use authenticated admin-only Supabase storage and are converted to bounded WebP. Removing a listing photo removes its link, not the underlying file. Photo previews load eagerly at thumbnail size so hiding an image until it loads cannot prevent loading. Preserve the existing neutral/mint/rose admin surfaces; no new packages or decorative motion.

Primary buttons are dark, pill-shaped, compact, and high contrast. Secondary buttons are light or translucent, with a subtle border and the same pill geometry.

Navigation is fixed, white or glass-white, and restrained. The PureForm wordmark uses Montserrat; links use Open Sans and stay small, uppercase-feeling, and quiet until hover or active state.

Product cards should emphasize image, product name, shade/material details, and a clear CTA. Keep them more editorial than marketplace-like: fewer badges, cleaner spacing, and no loud sale treatments.

Homepage and Shop cards adapt [ShadcnStore's Product Listing Card](https://dev.21st.dev/@shadcnstore/components/product-card-1)
using the existing storefront stack. Use a white, thin-bordered card with 12px
corners, an inset square contained photo with 8px corners, a quiet stock badge,
a compact product title and AED price, and an always-visible outlined Add to
cart button. Image and title clicks open the product; the independent button
adds one set with the existing stock checks and opens the cart. Keep card sizes
stable, with subtle sage button hover and no hidden panel or image zoom. Use a
single title link stretched over each article and keep the button above it.
Without JavaScript, a visible View set link opens the product instead. Prices,
photos and availability remain catalog-backed. Honor reduced motion.
Keep the Home and Shop section headings within the existing 960px content
column, but cap their centered product grids at 696px, with 18px gaps and
220px-wide desktop cards. Use 12px card padding, 15px titles and 16px prices.
On mobile, use a centered two-column grid capped at 300px including 4px edge
padding and a 12px column gap. Keep cards at most 140px wide, with 8px padding
and gaps inside each card. Wrap the third color onto a second row, with no
sideways card scrolling. Retain 44px shopping buttons and full, contained photos.
Keep the next card partially visible in the cart recommendations.

Use the visible product title to name linked cards. An image inside the same
link can have empty alternative text when the title already identifies the set.
Keep Clear cart available alongside the mobile order summary while the sticky
bar provides the checkout action. Show a browse link in place of delivery fields
when checkout opens with an empty cart. Show payment verification and confirmation
above the fold without the delivery form.

Cart and checkout use the visible-total and clear-next-action hierarchy reviewed
on noon UAE and Amazon UAE on 19 November 2026. Keep PureForm's neutral surfaces,
sage selection, fonts and dark buttons. The cart's second-set chooser is an
optional, initially collapsed native disclosure. A nonempty mobile cart always
shows a bottom bar with the total including delivery and Checkout, even while
that offer is open. Keep the desktop summary beside the items.

Checkout has a delivery stage followed by an editable delivery/payment review.
Continue to payment validates the existing UAE fields and opens the review
locally, without creating an order or payment session. Show contact, address,
delivery instructions when present, the actual delivery charge and total, and
one selected Credit or debit card method. The final action opens the existing
Stripe hosted checkout. Changes to the cart or price require another review;
editing keeps entered details. Keep optional delivery instructions collapsed,
mobile order details expandable and guest checkout available. Preserve server
price/stock checks, payment verification and gateway-controlled fulfillment.
Do not imitate marketplace branding or add unsupported wallets, installments,
cash on delivery, account requirements or local card-number fields.

Review cards should be text-forward with small metadata, subtle dividers, and steady grid behavior. They should support trust without overwhelming the product story.

Keep the homepage Customer reviews section visible at all sizes, with four featured photo reviews and a link to the full Reviews page. The Reviews page lists all eleven existing photo reviews. Use the named versions of the three entries that share photos with the original archive. Keep each named review's original photo, quote, date, rating and location. Show the other eight entries as originally recorded, without adding names or locations. Keep the UAE delivery scope separate from the review locations. Link to the full Reviews page from product pages so a single photo does not imply a review for each color. Arrange the featured cards in four columns on desktop and a two-by-two grid on smaller screens, with shorter photo frames on phones. Use a three-column desktop grid and stacked cards on mobile for the full list. Use contained, 200px photo frames, bounded lazy-loaded images and a matching local copy for each remotely hosted review photo. The homepage review section and storefront footer keep their review links.

For homepage review-anchor navigation, retain the focusable landmark but show its keyboard focus ring around the heading instead of enclosing the entire section. Keep a native focus indicator on review rows only when they need keyboard scrolling.

### Interactive Studio

The homepage uses only the attached upper canopy for leaf decoration. Omit the
detached lower-right sprig; it should not appear to float by itself over the floor.
Keep a separate, proportional 620:380 SVG crop of the supplied leaf texture
anchored to the scene's right edge at every width. The two sway hinges use their
upper-right origin; do not mirror or translate the entire scene-sized leaf rig
when resizing. Keep that anchor at the actual upper-right corner on phones too,
reserving headline space to its left. Decoration must not intercept the motion
or colour controls.

The hero background has an independently encoded JPEG of the same panorama as
an error-only fallback. Switch picture sources together when recovering, retain
the native proportions and keep a failed image icon hidden if both formats fail.
Do not substitute product photography for a failed background or reset the
selected colour, controls or scene geometry.
Retain the last loaded scenery underneath responsive source changes, so a new
image request during resize does not expose a blank stage.

The floating colour studio was approved for the homepage hero on 6 November
2026. Its separate review page remains in the local workspace.
Use the owner's matched Grey, matte Black and hot Pink Blender
renders, with a stationary stone arch and pedestal and four independently floating
product layers. Every colour shares the exact same crop, position and scale.
Place Grey / Black / Pink controls over the bottom of the hero scene; dissolve decoded layers over
an opaque previous colour without restarting the float. Use the supplied leaf
texture with anchored, nested CSS sway. Provide a motion toggle, reduced-motion
support and automatic offscreen/background pausing. Portrait previews crop only
the decorative sides; all four tools remain visible. Keep the original source
files and native render provenance in the local workspace.

The separate graphite Explore in 3D section was removed from the homepage at the
owner's request on 6 November 2026. Do not load its stylesheet, controller,
poster or model from the homepage. Retain the source assets locally for a possible later
restoration. What's included now flows directly into The daily ritual.

If the owner asks to restore it, the retained implementation follows these rules:
keep the floating hero, shopping cards and
photography in place. Use a contained lazy poster, a restrained 8px frame and an
explicit Load 3D scene button. Load the locally hosted model-viewer web component,
Draco decoder, GLB and lighting only after that action. No framework, external
decoder CDN, automatic rotation, AR or startup loading overlay is needed.

Keep all four tools visible initially on narrow and wide screens. Provide 44px
rotation, zoom, reset and Show photo controls, descriptive alternative text and
polite loading/failure messages. Preserve vertical touch scrolling. Reduced
motion makes button-driven camera changes immediate. Show photo removes the
interactive viewer; failure retains the photo and offers retry. A retry may use
neutral lighting. Keep the model cache at zero for detached models.

Identify the scene as an illustrative graphite visualisation with bathroom
accessories excluded. These are artistic models, not measured product scans;
actual admin-managed photos remain authoritative for appearance. Source and
export provenance live in the local 3D workspace.

## Do's and Don'ts

- Do keep product imagery large, inspectable, and central to the first screen.
- Do use soft mint, sage, rose, and gold as atmospheric accents over white surfaces.
- Do keep CTAs dark, clear, and limited to the main action per section.
- Do preserve generous spacing and thin borders for a premium bath-care feel.
- Don't introduce neon colors, heavy gradients, or loud ecommerce sale styling.
- Don't add nested cards or busy decorative panels around already framed content.
- Don't use dark blue, purple, beige, or brown as the dominant palette.
- Don't make hover, badge, or label text resize its container.
