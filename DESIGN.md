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
    fontFamily: Cormorant Garamond
    fontSize: 96px
    fontWeight: 300
    lineHeight: 0.92
    letterSpacing: 0em
  headline:
    fontFamily: Cormorant Garamond
    fontSize: 48px
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: 0em
  body:
    fontFamily: DM Sans
    fontSize: 15px
    fontWeight: 300
    lineHeight: 1.9
    letterSpacing: 0em
  label:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0.18em
  button:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.04em
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

Use Cormorant Garamond for brand, hero, and editorial headings. It should feel airy and elegant with light weights and generous line-height control.

Use DM Sans for navigation, body copy, product facts, buttons, and utility labels. Body copy should stay small, composed, and readable, usually 13px to 15px with long line height.

Labels and eyebrows are uppercase with wide tracking. They should be used sparingly to create quiet hierarchy, not as decorative filler.

## Layout

Lead with product imagery. The home page can use a full first-viewport hero with product art, soft radial or linear washes, and minimal overlaid copy. Interior pages should use a fixed 72px nav and generous top padding so content never hides behind the header.

Desktop layouts should use wide gutters, two-column hero sections, and product grids that breathe. Mobile layouts should collapse to a single column, keep CTAs full width where useful, and preserve enough vertical spacing that the site still feels premium.

Use section padding around 5rem on desktop and reduce gradually on mobile. Keep repeated product and review cards on predictable grids with stable dimensions so hover states do not shift the layout.

## Elevation & Depth

Depth should be quiet. Use thin borders, translucent white surfaces, soft shadows, and occasional backdrop blur for glass-like panels. Shadows should be broad and low-opacity, never harsh.

Product images can carry stronger drop shadows because they are the visual focus. Content panels should rely more on border, wash, and spacing than on stacked card depth.

## Shapes

The shape language is soft but controlled. Buttons and pill badges use fully rounded corners. Cards and panels use 8px to 24px radii depending on scale. Large hero panels can reach 28px when they need a plush, spa-like feel.

Avoid mixing sharp boxes with highly rounded controls in the same cluster. Keep product media containers, cards, and copy panels visually related.

## Components

Primary buttons are dark, pill-shaped, compact, and high contrast. Secondary buttons are light or translucent, with a subtle border and the same pill geometry.

Navigation is fixed, white or glass-white, and restrained. The PureForm wordmark uses the serif family; links stay small, uppercase-feeling, and quiet until hover or active state.

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
