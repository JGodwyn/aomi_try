---
description: Analyze a Figma file's exported context, recommend a build stack, and write the findings into CLAUDE.md
---

Analyze the Figma file the user is working from and help them decide what to
build it with. The user's specific question or focus, if any: $ARGUMENTS

## 1. Get the file context

Look for `design-sync/_file-context/CONTEXT.md` in the project root.

- If it's missing or stale (check the export date in its header against what
  the user is asking about), get a fresh export: make sure the bridge is
  running (`figma-bridge start`, from anywhere — you can start it in the
  background) and ask the user to open their file in Figma desktop → Plugins →
  Development → **Figma Bridge** → confirm the "Export to" folder is this
  project → click **Export file context**. Wait for them to confirm before
  reading.
- Never fall back to the Figma REST API or Figma MCP tools — the bridge exists
  because those are rate-limited.

## 2. Read and understand it

Read `CONTEXT.md`, and view a representative sample of the thumbnails in
`design-sync/_file-context/thumbs/` (the busiest pages first). When the token
system matters to the question, go deeper into the two data files next to it:
`variables.json` (all variable collections, Figma REST format, alias links
preserved) and `typography.json` (text styles as CSS-ready typography tokens).
Build a picture of:

- **Scope**: how many pages/screens, what kind of product (marketing site, app
  dashboard, mobile app…), desktop/mobile/both (frame sizes tell you).
- **Design-system maturity**: are there variable collections (real tokens —
  colors/spacing/radii)? Multiple modes (light/dark)? Text/paint styles?
  Component sets with variant props, or one-off frames?
- **Visual complexity**: gradients, effects, illustration-heavy art, custom
  fonts — anything that constrains the implementation approach.

## 3. Discuss and recommend

Answer whatever the user asked ($ARGUMENTS). Then give a grounded
recommendation for building it — framework, styling approach, component
library, and anything the file specifically demands — and justify each pick
from evidence in the file (e.g. "two variable modes → CSS variables with a
dark-mode theme layer", "38 component sets with variant props → a headless
component library styled to the tokens beats a themed kit"). If the project
already has a stack (existing package.json, CLAUDE.md), recommend within it
instead of proposing a replacement. Ask about anything that genuinely changes
the recommendation (target platform, team constraints) rather than assuming.

## 4. Write it into CLAUDE.md (or AGENTS.md)

Once the user is happy with the summary and recommendations, write them into
the project's agent instructions file — `CLAUDE.md`, or `AGENTS.md` if that's
what the project uses — inside clearly marked boundaries:

```
<!-- figma-bridge:context:start -->
## Design source & recommended stack
… (file name, export date, screens overview, token/component summary,
   the agreed stack with one-line justifications, and a pointer to
   design-sync/_file-context/ for details)
<!-- figma-bridge:context:end -->
```

- If neither file exists, create `CLAUDE.md` with just this section.
- If one exists, **never clobber it**: replace the content between existing
  figma-bridge markers if present, otherwise append the section at the end.
- Keep the section short — it loads on every message. Details stay in
  `design-sync/_file-context/`.
