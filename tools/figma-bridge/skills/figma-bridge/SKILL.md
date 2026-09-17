---
name: figma-bridge
description: Implement or verify UI against Figma designs using local exports in design-sync/ (frame.json + screenshot.webp + assets). Use whenever the user wants a screen/component built from Figma, mentions a Figma frame, an export, "Figma Bridge", or design-sync — or whenever you need to see a Figma design at all. Prefer this over the Figma REST API or Figma MCP tools; on free Figma plans both are rate-limited to unusable levels.
---

# Figma bridge — reading designs without the Figma API

Designs enter the repo as files, exported by the "Figma Bridge" Figma plugin
through a localhost bridge. Your job starts at `design-sync/` in the project
root. One global bridge server handles every project — the user picks the
target folder inside the Figma plugin UI, and the bridge remembers it per
Figma file (`~/.figma-bridge/config.json`).

## Workflow

1. **Check for an export first**: `ls -lat design-sync/` — one folder per
   exported frame, named after the frame. Check the timestamp and the `name` /
   `exportedAt` fields in `frame.json` to confirm it's the frame the user means,
   not a stale export.
2. **If the frame isn't there (or is stale), ask the user to export it.**
   You cannot pull from Figma yourself. The user needs to:
   - have the bridge running: `figma-bridge start` — from anywhere, one server
     serves all projects (you can start this in the background for them; check
     first with `curl -s http://localhost:4411`)
   - in Figma desktop: select the frame → Plugins → Development →
     **Figma Bridge** → confirm the "Export to" folder is this project →
     click **Export selection**
3. **Read the export** from `design-sync/<frame-slug>/`:
   - `screenshot.webp` — the frame at 2x. Read it first; it's ground truth for
     what the result must look like.
   - `frame.json` — full node tree: sizes, auto-layout, fills/strokes/effects,
     text, component/variant names, and resolved token bindings.
   - `assets/` — icons as SVG, image fills as WebP, referenced from `asset`
     fields in the tree. The bridge already optimized these (WebP q80, longest
     side ≤ 2880px) — copy them into the project's static-assets directory
     as-is, no further conversion needed.

## Interpreting frame.json

- **`variable` / `tokens` fields hold design-token names** (e.g.
  `Flame/Flame500`, `pad-lg`, `Body/body-lg-bold`). If the project has a design
  token system (check its CLAUDE.md / token files / CSS theme), map these names
  to the project's own utilities or CSS variables — never hardcode the raw
  hex/px values that also appear in the JSON when a token binding exists. If a
  token has no counterpart in the project, ask rather than guessing a close
  value.
- **`layout`** = auto-layout: `direction`/`gap`/`padding` ([top,right,bottom,left])
  /`justify`/`align` → flexbox. **`sizing`** `HUG`≈fit-content, `FILL`≈flex-1 or
  w-full, `FIXED`≈explicit size.
- **`component` / `variant` / `props`** on instances name the design-system
  component. Map to existing code components before writing new markup — search
  the project's component directory for a matching name first.
- **`asset` fields**: prefer the project's existing icon library when the icon
  obviously matches a named icon (arrow, envelope, user, folder…). Copy the
  exported file into the project only for non-icon art (backgrounds,
  illustrations, photos) — the WebP is already web-ready.
- **Text**: Figma copy can contain typos — flag and fix rather than copy
  blindly.
- `truncated: true` means the frame exceeded the node cap — ask the user to
  export a smaller piece.

## File context (whole-file inventory)

The plugin's **Export file context** button writes
`design-sync/_file-context/`:

- `CONTEXT.md` — the readable inventory: pages and top-level frames (with
  thumbnail links), variable-collection overview, typography table, paint and
  effect styles, component inventory, fonts, counts. **Read this first** at
  project start — it's the source for writing the project's AGENTS.md /
  CLAUDE.md.
- `variables.json` — every variable collection in Figma REST format: raw
  values per mode, `VARIABLE_ALIAS` links preserved, `linkedVariables` listing
  each variable's alias targets. Use it to generate token/theme files.
- `typography.json` — text styles as typography tokens (`fontSize`,
  `fontFamily`, `fontWeight`, `letterSpacing`, `lineHeight`, `css` var name).
- `thumbs/` — small WebP thumbnails of each top-level frame.

## Typography styles

The plugin's **Export typography styles** button writes
`design-sync/typography.json` on its own — the same token shape as the
file-context copy, so text styles can be refreshed without re-exporting the
whole file. Read it when generating type scales, CSS variables, or a theme
file; a file-context export does not overwrite it.

Use it to understand a whole file — what screens exist, whether there's a real
token system, how componentized the design is — before recommending an
architecture or building the first screen. The `/figma-context` command drives
the full analyze-and-write-CLAUDE.md flow.

## Verifying

After building, compare the running app against `screenshot.webp` (browser
screenshot side by side). Check token names in the built code against the
`tokens` fields in `frame.json`.

## Plumbing (when something breaks)

- Bridge: `figma-bridge start` (from anywhere) → localhost:4411 → writes
  `design-sync/` inside the folder chosen in the plugin UI. Folder choices
  live in `~/.figma-bridge/config.json` (`defaultFolder`, `recentFolders`,
  and a per-Figma-file `fileMap`).
- On first export into a project, the bridge auto-appends `design-sync/` to
  its `.gitignore` and installs this skill at
  `.claude/skills/figma-bridge/SKILL.md`.
- Exports landing in the wrong project → the plugin's "Export to" dropdown is
  pointing at another folder; fix it there (it's remembered per Figma file).
- Plugin source lives in the figma-bridge repo (`plugin/code.ts`); rebuild with
  `figma-bridge plugin build`. One-time install: Figma desktop → Plugins →
  Development → Import plugin from manifest → the path printed by
  `figma-bridge plugin path`.
- Different port: `figma-bridge plugin build --port N` (rewrites the manifest
  allowlist + UI), then run `figma-bridge start --port N`.
