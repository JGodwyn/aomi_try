# Figma Bridge

Gets Figma designs into any repo without the rate-limited REST API or MCP
server. A private Figma plugin serializes frames (or a whole file's context)
via the unmetered Plugin API and POSTs the result to a local bridge server,
which writes it into `design-sync/` in your project — where Claude Code (or any
agent) reads it off disk. No Figma API key, no AI API key: the plugin runs in
your logged-in Figma session, and the analysis intelligence is the agent you're
already running.

Also a Claude Code plugin: it ships the `figma-bridge` skill (how to read
exports) and the `/figma-context` command (analyze a file, recommend a stack,
write it into CLAUDE.md).

## One-time setup

```sh
git clone https://github.com/JGodwyn/figma-bridge.git ~/Code/figma-bridge   # or wherever
cd ~/Code/figma-bridge
npm install        # brings in sharp (WebP optimization) + build tooling
npm link           # makes the `figma-bridge` command available everywhere
```

Then:

1. **Figma plugin** — in the Figma **desktop** app: menu → Plugins →
   Development → **Import plugin from manifest…** → pick the path printed by
   `figma-bridge plugin path`.
2. **Claude Code plugin** (skill + `/figma-context` in every project):
   ```
   claude plugin marketplace add ~/Code/figma-bridge
   claude plugin install figma-bridge@figma-bridge
   ```

## Usage

1. `figma-bridge start` — from anywhere, once (leave it running). One server
   handles every project; no restarting when you switch.
2. In Figma: Plugins → Development → **Figma Bridge**. The plugin shows an
   **Export to** dropdown — pick the project with **Choose folder…** (native
   dialog). The choice is remembered per Figma file, so each design keeps
   exporting to its own project; the most recent choice is the default for
   new files. Then either:
   - select one or more frames → **Export selection**,
   - **Export file context** for a whole-file inventory, or
   - **Export typography styles** for the file's text styles as JSON.

Exports land in `<chosen folder>/design-sync/`. On the first export into a
project the bridge sets it up automatically: appends `design-sync/` to its
`.gitignore` (if it's a git repo) and installs the `figma-bridge` Claude
skill at `.claude/skills/figma-bridge/SKILL.md`, so Claude Code in that repo
knows how to read the exports without any plugin install.

Folder memory lives in `~/.figma-bridge/config.json`. For security, the
bridge only ever writes into folders you registered via the picker dialog or
by running `figma-bridge start` from a project directory — a request can't
name an arbitrary path.

### Frame exports → `design-sync/<frame-slug>/`

- `frame.json` — full node tree: auto-layout, fills/strokes/effects, text
  segments, component/variant info, and **token bindings** (`tokens` and
  `variable` fields hold Figma variable names)
- `screenshot.webp` — the frame at 2x
- `assets/` — icons as SVG, image fills as WebP (referenced from `asset`
  fields in `frame.json`)

### File context → `design-sync/_file-context/`

- `CONTEXT.md` — readable inventory of the file: pages and top-level frames
  (with thumbnail links), variable-collection overview, typography table,
  paint/effect styles, component inventory (sets + variant props), fonts, and
  summary counts. At project start an agent reads this to bootstrap an
  AGENTS.md / CLAUDE.md.
- `variables.json` — every variable collection in Figma REST format: raw
  values per mode with `VARIABLE_ALIAS` links preserved (plus a
  `linkedVariables` index per variable)
- `typography.json` — text styles as typography tokens (`fontSize`,
  `fontFamily`, `fontWeight`, `letterSpacing`, `lineHeight`, and a `css`
  variable name)
- `thumbs/` — small WebP thumbnails of each top-level frame

### Typography styles → `design-sync/typography.json`

**Export typography styles** writes the file's local text styles on their own,
in the same token shape as the file-context `typography.json` (`fontSize`,
`fontFamily`, `fontWeight`, `letterSpacing`, `lineHeight`, a `css` variable
name, plus `textCase` / `textDecoration` / `paragraphSpacing` when they differ
from the defaults). It sits outside `_file-context/`, so text styles can be
refreshed on their own and a later file-context export won't wipe it.

Use `/figma-context` in Claude Code to turn this into a summary, a build-stack
recommendation, and a `CLAUDE.md` section.

The bridge converts all PNG output to WebP (quality 80, longest side capped at
2880px for assets, 800px for thumbnails) via sharp — typically ~85% smaller
with no visible quality loss. If sharp is missing it falls back to writing the
original PNGs.

Re-exporting a frame (or the file context) replaces its folder, and
re-exporting typography styles overwrites `typography.json` — the latest
export is the source of truth.

## Notes

- The plugin main thread has no network access, so `ui.html` does the POST;
  `manifest.json` allowlists only `http://localhost:4411`.
- The port is baked into the plugin at build time (Figma allowlists exact
  origins). To change it: `figma-bridge plugin build --port N`, re-import the
  manifest isn't needed (same file), then run `figma-bridge start --port N`.
- Frame exports are capped at 4000 nodes per frame (`truncated: true` in
  `frame.json` if hit). File context caps: 40 thumbnails, 300 component
  entries.
- Plugin source is `plugin/code.ts`; `plugin/code.js` is compiled output
  (committed so installs need no build step) — rerun
  `figma-bridge plugin build` after editing.
