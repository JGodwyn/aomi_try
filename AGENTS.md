# Aomi prototype — agent rules

## Scope

Build only the single, mocked end-to-end Lido → Aave transaction flow described
in `aomi-product-design-context.md`. It is an interaction study, not a
redesign or a production onchain product.

## Browser testing

Always use Google Chrome when previewing or testing local websites. Provide the
user with a localhost URL for every runnable web implementation.

## Figma source of truth

`design-sync/_file-context/` is the source of truth for the design system.
Read its `CONTEXT.md`, `variables.json`, and `typography.json` before building
or changing UI. Use the Figma Bridge skill for any Figma-derived work.
The user exports screens after they are designed; do not attempt to fetch frames
directly from Figma. Verify implementation against the export once provided.

## Colors and typography — strict

- Use only color tokens from `design-tokens/colors.css`. Do not introduce a
  raw color value, opacity-based substitute, gradient color, or an additional
  color token unless it is first exported into the Figma file context.
- Use only typography tokens from `design-tokens/typography.css`. Do not
  introduce a font family, font size, line height, letter spacing, font weight,
  text transform, or text decoration outside the exported typography styles.
- The currently approved fonts are PT Serif and Geist only.
- If the exported system lacks a token needed for a design decision, ask the
  user to add or export it instead of approximating one.

## Motion

Before adding, changing, or reviewing animation, consult the local animation
skills: `animation-vocabulary`, `improve-animations`, and
`review-animations` (including its `STANDARDS.md`). Motion must have a clear
purpose, be frequency-appropriate, respect reduced-motion preferences, and use
GPU-friendly properties (`transform` and `opacity`) unless a documented
exception applies.
