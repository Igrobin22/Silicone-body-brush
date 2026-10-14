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

Lead with product imagery. The home page uses a full-width product photograph with unframed overlaid copy, a clear product name, a catalog-derived starting price, and a direct shopping action. Let the next section remain visible at the bottom of the first viewport. Keep the original neutral, mint and rose palette.

Use one homepage collection, followed by the four included tools, customer notes, and practical delivery/payment/return questions. Avoid repeating the same three products or displaying unconfigured promotion codes. Section layouts are unframed, with restrained borders and shared horizontal gutters.

The shared header is sticky: 106px on desktop including the announcement, and 72px on mobile. Keep Shop, The set, Reviews and FAQ as the main navigation, with support and the cart accessible. The cart remains visible on mobile. Avoid adding duplicate top padding beneath the sticky header.

Desktop product grids use three columns for the three listings. Mobile product grids use two columns, with readable names, prices, stock/offer labels, and square inspectable imagery. Color, in-stock and price-sort controls must update the displayed catalog and product count.

Product pages use a gallery beside the title, price, color-listing links, quantity and Add to cart on desktop. Mobile places the gallery first, followed by the same purchase information; care details follow the buying controls. Images remain contained and swipeable at every width. A mobile purchase bar appears after the main buying action scrolls out of view and uses the same cart behavior and stock checks.

On mobile checkout, show a compact expandable order summary with the current total above the contact and delivery fields. Keep the full summary visible beside the form on desktop.

Reserve large display typography for the homepage hero. Information-page titles use 40px on desktop and 28px on mobile; section headings use 32px and 26px. Checkout headings remain at 24px to 26px. Supporting hero images are capped at 260px on desktop and 180px on mobile, and customer photos at 200px to 220px. Main product galleries and collection imagery remain large enough to inspect.

Use section padding around 5rem on desktop and reduce gradually on mobile. Keep repeated product and review cards on predictable grids with stable dimensions so hover states do not shift the layout.

## Elevation & Depth

Depth should be quiet. Use thin borders, translucent white surfaces, soft shadows, and occasional backdrop blur for glass-like panels. Shadows should be broad and low-opacity, never harsh.

Product images can carry stronger drop shadows because they are the visual focus. Content panels should rely more on border, wash, and spacing than on stacked card depth.

## Shapes

The shape language is soft but controlled. Buttons and pill badges use fully rounded corners. Cards and panels use 8px to 24px radii depending on scale. Large hero panels can reach 28px when they need a plush, spa-like feel.

Avoid mixing sharp boxes with highly rounded controls in the same cluster. Keep product media containers, cards, and copy panels visually related.

## Components

Primary buttons are dark, pill-shaped, compact, and high contrast. Secondary buttons are light or translucent, with a subtle border and the same pill geometry.

Navigation is fixed, white or glass-white, and restrained. The PureForm wordmark uses Montserrat; links use Open Sans and stay small, uppercase-feeling, and quiet until hover or active state.

Product cards should emphasize image, product name, shade/material details, and a clear CTA. Keep them more editorial than marketplace-like: fewer badges, cleaner spacing, and no loud sale treatments.

Review cards should be text-forward with small metadata, subtle dividers, and steady grid behavior. They should support trust without overwhelming the product story.

## Do's and Don'ts

- Do keep product imagery large, inspectable, and central to the first screen.
- Do use soft mint, sage, rose, and gold as atmospheric accents over white surfaces.
- Do keep CTAs dark, clear, and limited to the main action per section.
- Do preserve generous spacing and thin borders for a premium bath-care feel.
- Don't introduce neon colors, heavy gradients, or loud ecommerce sale styling.
- Don't add nested cards or busy decorative panels around already framed content.
- Don't use dark blue, purple, beige, or brown as the dominant palette.
- Don't make hover, badge, or label text resize its container.
