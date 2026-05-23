# Design Standards

## Project design source
- Read `DESIGN.md` before making visual, layout, typography, color, or component changes.
- Treat `DESIGN.md` as the source of truth for the PureForm brand system and keep it updated when the visual system changes.

## Stack
- This is a static HTML/CSS/vanilla JavaScript site.
- Do not add React, Tailwind, shadcn, Framer Motion, GSAP, AOS, Lottie, or icon packages unless the project is intentionally migrated to a build pipeline.
- Use existing CSS files in `assets/` and page-local styles before adding new dependencies.

## Styling
- Follow the PureForm spa-minimal aesthetic defined in `DESIGN.md`.
- Use soft glass-like surfaces, restrained gradients, thin borders, and quiet motion.
- Keep product imagery large and inspectable.

## Animations
- Respect `prefers-reduced-motion`.
- Prefer CSS transitions and the existing Intersection Observer reveal pattern.
- Keep hover and tap interactions subtle and layout-stable.
