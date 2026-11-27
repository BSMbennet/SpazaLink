# SpazaLink UI quality standard

This is the design checklist for every new or revised SpazaLink screen. Preserve the existing SpazaLink visual identity and page structure; improve consistency without introducing an unrelated redesign.

## The 10-point release checklist

1. **Visual consistency** — Screens share the same header, content width, page gutters, card treatment, form patterns and navigation behaviour.
2. **Typography** — Use the system font stack for low-data performance. Keep a clear heading/body/helper hierarchy, comfortable line-height and readable body text.
3. **Colour and contrast** — Use the existing forest-green, shop-sign yellow and clay accent palette. Text, controls, focus indicators and states must remain legible in light and dark themes. Never communicate status by colour alone.
4. **Spacing and layout** — Use the shared spacing tokens and a consistent content grid. Keep predictable gaps and align related content.
5. **Components** — Reuse the existing button variants, card surfaces, inputs, labels, notices and status pills. Avoid one-off styling when a shared pattern exists.
6. **Iconography** — Keep icons optically consistent: 20px default size, consistent stroke weight, aligned to text and never used as the only label for an action.
7. **Responsive behaviour** — Verify narrow phones (320–420px), larger phones, tablets (761–1024px) and desktop. Avoid horizontal page overflow; keep forms and navigation usable.
8. **Accessibility** — Semantic headings and landmarks, explicit form labels, keyboard access, visible focus, sufficient contrast, descriptive image alt text, reduced-motion support and comfortable 44–48px touch targets.
9. **UI states** — Design and test loading/pending, empty, error, success, disabled and validation states. Use live regions or alert roles where appropriate and provide a clear recovery action.
10. **Design system** — Keep colour, type, spacing, radius, shadows, control heights and icon dimensions in the shared tokens in `frontend/src/app/globals.css`. Extend shared components before adding page-specific variants.

## Existing SpazaLink tokens and patterns

- Brand: forest green with yellow shop-sign action and clay accent.
- Typography: system font stack; no remote font dependency.
- Content width: 1120px.
- Controls: 48px minimum height; navigation and compact actions at least 44px.
- Icon baseline: 20px, 1.8 stroke width.
- Layout breakpoints: 1024px tablet refinement, 760px mobile layout, 420px compact phone refinement.
- Existing shared patterns: `.button`, `.button-primary`, `.button-secondary`, `.button-quiet`, `.button-danger`, `.feature-card`, `.product-card`, `.form-stack`, `.notice`, `.empty-state`, `.status-pill`.

## Before marking a screen complete

- [ ] Check the screen at phone, tablet and desktop widths.
- [ ] Tab through every interactive element and verify focus is visible.
- [ ] Check labels, validation messages, touch sizes and text contrast.
- [ ] Verify loading, empty, error and success states (including recovery paths).
- [ ] Confirm no business logic, payment rules, permissions or data handling changed as a side effect of visual work.
- [ ] Run frontend tests, lint, typecheck and production build.

A screen is not "ready" merely because its default state looks polished. All ten checklist areas must be reviewed and evidenced.
