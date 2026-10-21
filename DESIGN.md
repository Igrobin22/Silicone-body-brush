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

## Typography

Use Montserrat for the PureForm wordmark, hero, section headings, and product titles. Use regular to medium weights (400 to 500) for a familiar, clean storefront feel, with enough line height for multi-line headings.

Use Open Sans for navigation, body copy, product facts, forms, buttons, and utility labels. Body copy uses regular weight (400), usually 13px to 15px with comfortable line height; controls and important details can use 500 to 600. Larger price totals may use Montserrat to match nearby headings.

Use normal letter spacing (0) throughout. Labels and eyebrows may be uppercase, used sparingly to create quiet hierarchy.

Load the same Montserrat and Open Sans Google Fonts request on every storefront and admin page, with `display=swap` and preconnections to the font hosts. Use Arial and the browser sans-serif as fallbacks. Normalize fallback size with `font-size-adjust: from-font` where supported; older browsers retain the normal fallback stack.

## Layout

Lead with product imagery. The home page restores the original "Soft touch. Deep clean. Every day." composition: a centered product photograph in a full-width white hero, unframed copy on the left, and quiet set facts on the right. Contain the original photo with softly blended side edges so it stays uncropped on wide screens. The desktop Start Order action and price follow the Grey listing's admin data; unavailable Grey sets link to the collection instead. Mobile keeps the original three-line headline and Explore Set action below the product scene, with set facts underneath. Tablet widths through 1000px use this compact composition, with the full desktop photograph contained above the text. Let the next section remain visible at the bottom of the first viewport. Keep the original neutral, mint and rose palette.

Use one homepage collection, followed by the four included tools, a compact lifestyle photo row, customer notes, and practical delivery/payment/return questions. Avoid repeating the same three products or displaying unconfigured promotion codes. Section layouts are unframed, with restrained borders and shared horizontal gutters.

The lifestyle row uses three reference-based AI-styled scenes: the Grey set beside a basin, the Grey body brush being rinsed and the Pink set on a shower shelf. Keep it separate from customer reviews and admin-managed catalog photography; do not imply a verified purchase or use these images as product evidence. A quiet disclosure identifies styled scenes and notes that bathroom accessories are not included. Use complete square photos without cropping, three columns on desktop and a native keyboard-scrollable strip on mobile with a hint of the next photo. Caption links open the matching color. Deliver local 600px and 1200px WebP sources with explicit dimensions, lazy loading and asynchronous decoding; do not change the original hero or load new image libraries.

The rest of the storefront uses a consistent retail structure, inspired by the reference retailer's information hierarchy rather than its branding. Preserve the homepage hero markup and appearance. Use a shared 1360px outer width with 40px desktop and 20px mobile gutters, compact breadcrumbs, literal page titles and white, divided content areas. Collection cards keep contained square photos, catalog prices and functional filters. Cart and checkout show visible titles, a Cart / Delivery / Card payment progress indicator, and readable summaries without nested cards. FAQ groups use native disclosures with topic links; policies use a table of contents and flat reading sections. Support offers email, Telegram, practical help links and the existing email-draft form. Do not show fixed bundle prices in support forms. Keep the same four-column Shop / Customer care / Contact footer across storefront pages, with two columns on mobile. Do not introduce memberships, extra product categories, invented guarantees or unconfigured offers.

The shared header is sticky: 106px on desktop including the announcement, and 72px on mobile. Main navigation is Home, Shop, Reviews, About, then Policies & FAQ, in that order. Do not include The set or separate Policy and FAQ menu items. Use the same destinations and current-page state in the mobile menu, with support and the cart accessible. Combine all FAQ topics and policy text on policy.html, retaining delivery, return, privacy and FAQ fragment links. The old faq.html address redirects there and preserves its fragment. Keep the included-tools content and homepage hero unchanged. Avoid adding duplicate top padding beneath the sticky header.

Desktop navigation follows the supplied tabs reference: one 6px-radius translucent grey highlight slides between hovered or focused links over 300ms, with a thin black current-page underline. Use actual anchors and aria-current, not tab roles or a default Home selection. Match measurements after fonts load and on resize; keep labels stationary, touch areas 44px high and tablet spacing compact. The underline has its own native view-transition name so it moves between actual pages while the header stays still. Reduced motion keeps both decorations static. Adapt the reference in the existing vanilla JavaScript/CSS, with no framework or new dependencies. Keep the current modal drawer on mobile.

Desktop product grids use three columns for the three listings. Mobile product grids use two columns, with readable names, prices, stock/offer labels, and square inspectable imagery. Color, in-stock and price-sort controls must update the displayed catalog and product count.

Product pages follow a retail product-detail structure: breadcrumbs, an inspectable gallery on the left and a compact purchase area on the right. Keep the product title, photo-review link, catalog-backed price/discount, color links, delivery, quantity and Add to cart together. Use flat dividers rather than nested purchase cards. The gallery has photo thumbnails and a native modal for enlargement, with contained images and horizontal swipe at every width. Below the purchase area, use a restrained service strip and anchor links to product details, specifications, delivery/returns and existing photo reviews; related colors follow those sections. Details use native disclosures and a compact key/value specification list. Mobile stacks the gallery before the purchase information, with 16px quantity text and touch-sized controls. A mobile purchase bar appears after the main buying action scrolls out of view and uses the same cart behavior and stock checks. Preserve PureForm's fonts, palette and actual policies rather than borrowing another retailer's brand or promises.

On mobile checkout, show a compact expandable order summary with the current total above the contact and delivery fields. Keep the full summary visible beside the form on desktop.

Use 16px input, select and textarea text on mobile, including quantities and discount codes, to keep forms readable and avoid focus zoom on iOS. Desktop form sizes stay compact.

Show AED 10 UAE delivery for one set and free UAE delivery for two or more sets, separately from the product subtotal in cart, sticky-cart and checkout. Shipping is charged once per order, never per set, and is zero for an empty cart. The server calculates eligibility from validated quantities, including matching colors. Stripe verifies payments before the return page clears a cart; verification failures retain the cart and offer a payment-status retry without creating another checkout.

Keep cart rows and quantity controls stable during edits and catalog refreshes, preserving keyboard focus and unfinished input. Synchronize cart and checkout summaries across tabs and restored history pages without writing storage events back in a loop. Saved items hidden by admin stay reviewable and removable, clearly unavailable with checkout blocked; never replace an empty admin catalog with purchasable fallback stock.

With exactly one available set in the cart, show a compact quantity-based delivery progress line and a second-set chooser immediately below the items. Use three visible native radio choices with actual catalog photos and AED prices, omit unavailable options, and preview the complete new total before adding. Add exactly one set without leaving the cart. At two or more sets, replace the chooser with a quiet free-delivery confirmation; never keep upselling after qualification. Verify the deployed shipping rule and fresh catalog before displaying this enhancement, and preserve keyboard focus as it collapses. This is the existing AED 10 delivery waiver, not a free second product or an additional discount.

Product quantity changes show a selected-sets subtotal above Add to cart; shipping remains separately explained. Refresh prices, discount labels and structured data from the same admin catalog without resetting gallery position. Missing or hidden listings are unavailable, and adding must succeed in full rather than silently reducing the requested quantity. Include a native Use & care disclosure with three short, numbered steps and no medical promises. Match each tool label to its actual photograph, regardless of legacy asset filenames; the tool overview shows Grey and Pink reference pieces and explicitly notes that a purchased set contains one selected color.

Open a linked product disclosure on direct entry and fragment changes without forcing document scrolling. Use the existing reduced-motion-aware rise reveal on routine steps; cart offers, prices and add actions remain stationary. Reference patterns reviewed: [OSEA's product and contextual delivery structure](https://oseamalibu.com/products/bodycare-bestsellers-set), [Blueland's explicit set contents](https://www.blueland.com/products/laundry-starter-set), and Baymard's research on [buy-area shipping clarity](https://baymard.com/research-articles/avoid-banners-only-free-shipping) and [relevant cart offers](https://baymard.com/research-articles/product-recommendations-cart). These inform hierarchy, not copied branding, reviews or product claims.

Use a compact 1 + 1 combo offer below the catalog and product purchase area, with two selectable colors, actual product photos and current admin-backed prices. The offer is two paid sets with free delivery, saving AED 10; never imply a free second set or apply another AED 10 product discount. Show the offer only when the deployed checkout confirms its delivery rule. Keep the original hero unchanged. Public listing and product status lines may show real available stock, all-time sold sets and sets sold in the current UAE calendar week. Count only paid, non-cancelled, non-refunded live Stripe orders, never sandbox activity. Refresh actual stock quietly without restarting galleries or section animations. Do not fabricate shoppers, sales, countdowns or visitor-specific stock depletion; hide unavailable metrics instead.

For local design testing only, `?demo=activity` may add separately labeled Demo data below the real product figures. Enable it only on loopback hosts, never public domains or checkout/admin pages. Sample viewers, sold counts and stock are read-only fixtures with a persistent preview clock, explicit pause/reset/exit controls and a reduced-motion pause. They must not change the catalog, cart, structured data, backend or checkout, or replace real metrics. The original hero is unchanged.

Reserve large display typography for the homepage hero. Information-page titles use 40px on desktop and 28px on mobile; section headings use 32px and 26px. Checkout headings remain at 24px to 26px. Supporting hero images are capped at 260px on desktop and 180px on mobile, and customer photos at 200px to 220px. Main product galleries and collection imagery remain large enough to inspect.

Use section padding around 5rem on desktop and reduce gradually on mobile. Keep repeated product and review cards on predictable grids with stable dimensions so hover states do not shift the layout.

## Elevation & Depth

Depth should be quiet. Use thin borders, translucent white surfaces, soft shadows, and occasional backdrop blur for glass-like panels. Shadows should be broad and low-opacity, never harsh.

Product images can carry stronger drop shadows because they are the visual focus. Content panels should rely more on border, wash, and spacing than on stacked card depth.

## Shapes

The shape language is soft but controlled. Buttons and pill badges use fully rounded corners. Cards and panels use 8px to 24px radii depending on scale. Large hero panels can reach 28px when they need a plush, spa-like feel.

Avoid mixing sharp boxes with highly rounded controls in the same cluster. Keep product media containers, cards, and copy panels visually related.

## Components

### Opening Intro

On the first external homepage entry per tab, show a short photographic launch adapted from the supplied HeroLaunch reference. Include all three colors in Grey / Black / Pink order: the existing Grey vanity scene, the Black listing's current back-brush photograph and the Pink shower scene. Disclose only Grey and Pink as AI-styled, never imply the Black close-up is a new full-set photograph, and never use customer-review photos. Grey starts large and centered, recedes left while Black and Pink glide in, then all three leave downward to reveal the PureForm wordmark and original tagline. At 2900ms, the white opening layer lifts away over 700ms to uncover the unchanged, already-settled homepage hero. Keep all square photographs complete, with 8px photo corners and quiet color captions, and scale their fixed framing for narrow/landscape screens. Use finite CSS transforms and opacity, not looping media, 3D, dark vignettes or a new framework. Keep Montserrat/Open Sans and the white palette. Reuse optimized 600px WebPs totaling under 125KB at low priority; provenance is documented in assets/intro/README.md. If any image is broken or still unavailable after 350ms, skip the decoration. CSS auto-hides the layer and a 4000ms JavaScript fallback removes it independently. Never wait for fonts, catalog data or payment services, or simulate progress. The document stays readable to assistive technology, scrollable and interactive; any pointer, keyboard, touch, wheel or focus interaction dismisses immediately. Do not move focus, intercept navigation, lock scrolling, scroll to the hero or insert layout space. Skip reduced motion, missing styles/scripts/storage, already-painted content, same-site navigation, reload/history, fragments and payment callbacks. Product, collection, information, cart, checkout, admin, recovery and redirect pages do not load the intro. A loopback-only `?preview=intro` homepage link can replay it for review while still honoring reduced motion and image failures. Use the versioned per-tab marker pureform.intro.v4 so this replaces rather than follows the earlier openings.

Portrait phones through 600px arrange Grey and Black in the first row with Pink centered below. Keep photos up to 220px wide and leave room for each caption, the opening label and the disclosure; landscape/tablet/desktop show one evenly spaced row of all three colors. Short landscape screens reduce the initial zoom to keep the opening photograph complete.

### Page Transitions

Use native same-origin cross-document view transitions for storefront navigation: a quiet 240ms incoming dissolve over a fully opaque outgoing page, with the shared header and mobile menu toggle kept visually stationary. Never fade both snapshots away together, which exposes white between pages. Keep menu labels stationary while their highlight and underline move. Do not delay clicks, replace native links/history with a client router, blur the page, or animate the entire body. Wait for the main content markup before capturing the destination and exclude closing mobile drawers from outgoing snapshots. Settle visible content before the incoming capture by disabling its section keyframes and resetting translate/scale; normal reveals remain below the fold. Unsupported browsers and file previews use only a near-opaque 160ms content settle, never a fade from blank. Reduced-motion users get instant transitions. Keep admin/authentication pages and external card checkout outside this storefront enhancement.

### Section Motion

Use the existing store-flow Intersection Observer for six restrained entrance styles: fade, rise, drop, left/right slide and soft zoom. Page titles drop in; product rows rise with short staggered delays; tool images gently scale in; customer reviews slide in; FAQ headings, question rows and policy sections use complementary directions. Preserve the hero's artwork, layout and controls; only its headline and supporting paragraph receive a light text entrance. Never animate whole sticky containers, live cart rows, prices, quantity controls, checkout fields or payment actions. Keep entrance movement within 24px, scale at 0.96 or above, duration around 520ms and stagger delays capped at 165ms. Use independent translate/scale properties so hover transforms remain stable. Avoid permanent will-change layers, blur, bouncing and continuous motion outside the restored hero soap bubbles.

Restore the original twelve small translucent soap bubbles over the hero product scene, using their existing sizes, staggered timing and upward drift. Keep them clipped to the image area and behind the copy; they are decorative, hidden from assistive technology and never intercept taps. A quiet 44px pause/resume icon sits in the image's upper-right corner. Pause bubbles while offscreen, in a background tab or during page exit; disable them for reduced motion and when observers are unavailable. Keep the photograph, bubbles and motion control inside one shared scene, capped at 1600px on desktop with a contained, uncropped photo. At tablet and mobile widths the scene sits in normal flow before the headline, without fixed top-padding offsets or photo/text overlap; use a 300px tablet scene and a 220px to 320px mobile scene based on viewport height. Preserve the original photos, copy, fonts and colors; do not introduce photo movement, background orbs or extra image assets.

Catalog changes register with the same observer, but already-seen product rows update instantly instead of replaying. Keyboard focus reveals content immediately and cancels its entrance. A reduced-motion change and back/forward-cache restore show all pending content instantly. Missing observers fail open; JavaScript-disabled pages remain readable. Keep admin, recovery and redirect pages outside this decorative motion.

Keep document scroll behavior automatic so reloads, fragment destinations and browser history restore without a smooth-scroll journey that consumes section entrances. Do not force reloads to the top or replace native history restoration. Exclude animated targets and replaceable catalog grids from scroll anchoring, without turning anchoring off for the entire document. Lay out this small storefront's sections normally; do not apply generic content-visibility placeholders with guessed section heights, which shift restored positions as content renders. Keep below-fold photos lazy-loaded. Tool-photo frames use shrinkable grid tracks and bounded images, so their fixed responsive height never lets a photo overlap its label.

### Admin Orders

Keep the orders workspace compact and work-focused: 28px page headings, 20px section headings, and readable 13px to 14px table text. The order table uses the full content width; selected order details follow below it in normal page flow, without a fixed-height nested scroller. View moves focus to the selected order, and Back to orders returns to the list. On narrow screens, show each order as a labeled block with visible status, payment and actions. Mobile admin navigation wraps into two rows so every section stays visible. Use flat, divided detail fields instead of nested cards; long emails, addresses and gateway IDs wrap. Mobile form controls use 16px text. Preserve the existing fonts, neutral/mint/rose colors, authentication and read-only gateway payment state.

Primary buttons are dark, pill-shaped, compact, and high contrast. Secondary buttons are light or translucent, with a subtle border and the same pill geometry.

Navigation is fixed, white or glass-white, and restrained. The PureForm wordmark uses Montserrat; links use Open Sans and stay small, uppercase-feeling, and quiet until hover or active state.

Product cards should emphasize image, product name, shade/material details, and a clear CTA. Keep them more editorial than marketplace-like: fewer badges, cleaner spacing, and no loud sale treatments.

Review cards should be text-forward with small metadata, subtle dividers, and steady grid behavior. They should support trust without overwhelming the product story.

Keep the homepage Customer reviews section visible at all sizes, with three columns on desktop and a native swipeable row on mobile. Leave a hint of the next card visible on narrow screens, support keyboard scrolling, and keep each photo contained in a stable 200px-high frame. Use the same photo, quote, attribution and rating pairings already shown on the product page; lazy-load bounded images and do not add new rating claims or verified-purchase badges. Each homepage review has a local fallback of that same photo, never a generic product replacement. On the mobile hero, include a quiet Customer reviews text link with a 44px touch target that scrolls to the homepage reviews. The main Reviews navigation link and Read all reviews open the full reviews page.

For homepage review-anchor navigation, retain the focusable landmark but show its keyboard focus ring around the heading instead of enclosing the entire section. Keep the review row's native focus indicator for keyboard scrolling.

## Do's and Don'ts

- Do keep product imagery large, inspectable, and central to the first screen.
- Do use soft mint, sage, rose, and gold as atmospheric accents over white surfaces.
- Do keep CTAs dark, clear, and limited to the main action per section.
- Do preserve generous spacing and thin borders for a premium bath-care feel.
- Don't introduce neon colors, heavy gradients, or loud ecommerce sale styling.
- Don't add nested cards or busy decorative panels around already framed content.
- Don't use dark blue, purple, beige, or brown as the dominant palette.
- Don't make hover, badge, or label text resize its container.
