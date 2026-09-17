// Figma bridge server — receives exports from the "Figma Bridge" Figma plugin
// and writes them into the target project's design-sync/ directory.
//
// One global server serves every project: the target folder is resolved per
// export from ~/.figma-bridge/config.json (folder remembered per Figma file,
// falling back to the default folder), and the plugin UI drives folder
// selection through /config, /pick and /select.
//
// Node built-ins only, plus sharp when available to convert PNGs to WebP.
// Run via: figma-bridge start [--port 4411]

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";

export const DEFAULT_PORT = 4411;
const OUT_DIR = "design-sync";
const MAX_BODY_BYTES = 200 * 1024 * 1024;
const MAX_RECENT_FOLDERS = 8;

const PKG_ROOT = path.dirname(fileURLToPath(import.meta.url));

// WebP at q80 is visually indistinguishable for UI art at a fraction of PNG's
// size; 2880px caps at 2x of a 1440-wide desktop frame.
const WEBP_QUALITY = 80;
const MAX_DIMENSION = 2880;
// File-context thumbnails are for orientation, not pixel-perfect implementation.
const THUMB_MAX_DIMENSION = 800;

const CONTEXT_DIR = "_file-context";

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn(
    "sharp not found — writing assets as unoptimized PNGs. (Run npm install in the figma-bridge repo to get it.)"
  );
}

// ---------------------------------------------------------------------------
// Config — ~/.figma-bridge/config.json
// ---------------------------------------------------------------------------

const CONFIG_DIR = path.join(os.homedir(), ".figma-bridge");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function loadConfig() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {}
  return {
    defaultFolder: typeof raw.defaultFolder === "string" ? raw.defaultFolder : null,
    recentFolders: Array.isArray(raw.recentFolders)
      ? raw.recentFolders.filter((f) => typeof f === "string")
      : [],
    fileMap: raw.fileMap && typeof raw.fileMap === "object" ? raw.fileMap : {},
  };
}

export function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n");
}

// Adds a folder to the front of the recents list (the allowlist of writable
// targets) and makes it the default if there is none yet.
export function registerFolder(cfg, folder) {
  const abs = path.resolve(folder);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }
  cfg.recentFolders = [abs, ...cfg.recentFolders.filter((f) => f !== abs)].slice(
    0,
    MAX_RECENT_FOLDERS
  );
  if (!cfg.defaultFolder) cfg.defaultFolder = abs;
  return abs;
}

// The target for an export: the folder remembered for this Figma file, else
// the default. Anything not in recentFolders (the user-registered allowlist)
// is ignored — a request body must never be able to name an arbitrary path,
// since any webpage can POST to localhost.
function resolveTarget(cfg, fileId) {
  const candidates = [fileId ? cfg.fileMap[fileId] : null, cfg.defaultFolder];
  for (const folder of candidates) {
    if (folder && cfg.recentFolders.includes(folder) && fs.existsSync(folder)) {
      return folder;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Folder picker — native macOS dialog via osascript. Telling the frontmost
// app (Figma, since the user just clicked the plugin) keeps the dialog in
// front. AppleScript error -128 = user canceled.
// ---------------------------------------------------------------------------

function pickFolder() {
  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      [
        "-e", 'tell application (path to frontmost application as text)',
        "-e", '  set _f to choose folder with prompt "Figma Bridge: export into which project folder?"',
        "-e", "end tell",
        "-e", "POSIX path of _f",
      ],
      (err, stdout, stderr) => {
        if (err) {
          if (String(stderr).includes("-128")) resolve(null); // canceled
          else reject(new Error(stderr.trim() || err.message));
          return;
        }
        resolve(stdout.trim().replace(/\/$/, ""));
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Project bootstrap — first export into a folder gitignores design-sync/ and
// installs the figma-bridge Claude skill so agents in that repo know the
// workflow. Idempotent; runs before every write.
// ---------------------------------------------------------------------------

function bootstrapProject(target) {
  const notes = [];

  if (fs.existsSync(path.join(target, ".git"))) {
    const ignored =
      spawnSync("git", ["-C", target, "check-ignore", "-q", OUT_DIR], {
        stdio: "ignore",
      }).status === 0;
    if (!ignored) {
      const gitignorePath = path.join(target, ".gitignore");
      let src = "";
      try {
        src = fs.readFileSync(gitignorePath, "utf8");
      } catch {}
      const prefix = src && !src.endsWith("\n") ? "\n" : "";
      fs.appendFileSync(gitignorePath, `${prefix}${OUT_DIR}/\n`);
      notes.push(`added ${OUT_DIR}/ to .gitignore`);
    }
  }

  const skillSrc = path.join(PKG_ROOT, "skills", "figma-bridge", "SKILL.md");
  const skillDest = path.join(target, ".claude", "skills", "figma-bridge", "SKILL.md");
  if (fs.existsSync(skillSrc) && !fs.existsSync(skillDest)) {
    fs.mkdirSync(path.dirname(skillDest), { recursive: true });
    fs.copyFileSync(skillSrc, skillDest);
    notes.push("installed Claude skill (.claude/skills/figma-bridge)");
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Export writing
// ---------------------------------------------------------------------------

async function optimizePng(buf, maxDimension = MAX_DIMENSION) {
  if (!sharp) return null;
  try {
    return await sharp(buf)
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (e) {
    console.warn("webp conversion failed, keeping png:", e.message);
    return null;
  }
}

// The plugin slugifies names, but never trust a path from the network.
function safeSegment(s) {
  const clean = String(s).replace(/[^a-z0-9._-]/gi, "-").replace(/^\.+/, "");
  if (!clean) throw new Error(`Unsafe path segment: ${s}`);
  return clean;
}

function kb(n) {
  return `${Math.round(n / 1024)} KB`;
}

// Writes a binary asset, converting PNG → WebP when possible. Returns the
// (possibly renamed) relative path and a size note for the log.
async function writeAsset(baseDir, relPath, b64, format, maxDimension) {
  const parts = String(relPath).split("/").map(safeSegment);
  let buf = Buffer.from(b64, "base64");
  let note = ` (${kb(buf.length)})`;
  let outRel = parts.join("/");
  if (format === "png") {
    const webp = await optimizePng(buf, maxDimension);
    if (webp) {
      note = ` (${kb(buf.length)} → ${kb(webp.length)})`;
      buf = webp;
      parts[parts.length - 1] = parts[parts.length - 1].replace(/\.png$/i, ".webp");
      outRel = parts.join("/");
    }
  }
  const absPath = path.join(baseDir, ...parts);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, buf);
  return { outRel, absPath, note };
}

// Rewrites renamed asset paths (foo.png → foo.webp) inside already-serialized
// JSON, so `asset`/`thumb` references always point at the file actually written.
function applyRenames(json, renames) {
  for (const [oldPath, newPath] of renames) {
    json = json.replaceAll(`"${oldPath}"`, `"${newPath}"`);
  }
  return json;
}

async function writeExport(payload, outRoot, projectRoot) {
  if (!Array.isArray(payload.frames) || payload.frames.length === 0) {
    throw new Error("Payload has no frames");
  }
  const written = [];
  const dirs = [];

  for (const frame of payload.frames) {
    const slug = safeSegment(frame.slug);
    const frameDir = path.join(outRoot, slug);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
    dirs.push(path.relative(projectRoot, frameDir));

    // assets/foo.png may become assets/foo.webp — remember renames so the
    // `asset` references inside the tree JSON can be rewritten to match.
    const renames = new Map();

    if (frame.screenshotB64) {
      const png = Buffer.from(frame.screenshotB64, "base64");
      const webp = await optimizePng(png);
      const shotPath = path.join(frameDir, webp ? "screenshot.webp" : "screenshot.png");
      fs.writeFileSync(shotPath, webp ?? png);
      written.push(
        `${path.relative(projectRoot, shotPath)}` +
          (webp ? ` (${kb(png.length)} → ${kb(webp.length)})` : ` (${kb(png.length)})`)
      );
    }

    for (const asset of frame.assets || []) {
      const { outRel, absPath, note } = await writeAsset(
        frameDir,
        asset.path,
        asset.b64,
        asset.format,
        MAX_DIMENSION
      );
      if (outRel !== asset.path) renames.set(asset.path, outRel);
      written.push(path.relative(projectRoot, absPath) + note);
    }

    const meta = {
      file: payload.file,
      page: payload.page,
      exportedAt: payload.exportedAt,
      name: frame.name,
      nodeCount: frame.nodeCount,
      truncated: frame.truncated || undefined,
      assets: (frame.assets || []).map((a) => renames.get(a.path) ?? a.path),
      tree: frame.tree,
    };
    const json = applyRenames(JSON.stringify(meta, null, 2), renames);
    const jsonPath = path.join(frameDir, "frame.json");
    fs.writeFileSync(jsonPath, json);
    written.push(path.relative(projectRoot, jsonPath));
  }
  return { written, dirs };
}

// ---------------------------------------------------------------------------
// CONTEXT.md rendering
// ---------------------------------------------------------------------------

function mdEscape(s) {
  return String(s).replace(/\|/g, "\\|");
}

function mdTable(headers, rows) {
  if (rows.length === 0) return "_none_\n";
  const line = (cells) => `| ${cells.map(mdEscape).join(" | ")} |`;
  return [
    line(headers),
    `|${headers.map(() => " --- ").join("|")}|`,
    ...rows.map(line),
  ].join("\n") + "\n";
}

// A short human summary of one paint entry from the plugin's serializer.
function paintLabel(p) {
  if (!p || typeof p !== "object") return "?";
  return String(p.hex ?? p.variable ?? p.type ?? "?");
}

// Renders the whole-file inventory as an onboarding document. Token *data*
// stays in variables.json / typography.json — this is the readable overview.
function renderContextMd(payload) {
  const ctx = payload.context;
  const md = [];

  md.push(`# Figma file context — ${payload.file}`);
  md.push("");
  md.push(
    `Exported ${payload.exportedAt} by Figma Bridge. This folder is the design file's inventory — use it at project start to understand the design system and to write the project's AGENTS.md / CLAUDE.md (the \`/figma-context\` command automates that). The machine-readable token data lives next to this file:`
  );
  md.push("");
  md.push("- `variables.json` — all variable collections, Figma REST format, alias links preserved");
  md.push("- `typography.json` — text styles as typography tokens (CSS-ready values)");
  md.push("- `thumbs/` — thumbnails of top-level frames, linked below");
  md.push("");

  md.push("## Pages & screens");
  md.push("");
  for (const page of ctx.pages || []) {
    md.push(`### ${page.name}`);
    md.push("");
    md.push(
      mdTable(
        ["Frame", "Type", "Size", "Thumbnail"],
        (page.frames || []).map((f) => [
          f.name,
          f.type,
          `${f.w}×${f.h}`,
          f.thumb ? `[view](${f.thumb})` : "",
        ])
      )
    );
  }

  md.push("## Variable collections");
  md.push("");
  const variables = payload.variables || {};
  // varId → collection name, for describing where aliases point.
  const varCollection = {};
  for (const col of Object.values(variables)) {
    for (const id of Object.keys(col.variables || {})) {
      varCollection[id] = col.name;
    }
  }
  md.push(
    mdTable(
      ["Collection", "Modes", "Variables", "Types", "Aliases into", "Examples"],
      Object.values(variables).map((col) => {
        const vars = Object.values(col.variables || {});
        const types = {};
        const aliasTargets = new Set();
        for (const v of vars) {
          types[v.resolvedType] = (types[v.resolvedType] || 0) + 1;
          for (const id of v.linkedVariables || []) {
            if (varCollection[id]) aliasTargets.add(varCollection[id]);
          }
        }
        return [
          col.name,
          (col.modes || []).map((m) => m.name).join(", "),
          String(vars.length),
          Object.entries(types).map(([t, n]) => `${n} ${t}`).join(", "),
          [...aliasTargets].join(", ") || "—",
          vars.slice(0, 3).map((v) => v.name).join(", "),
        ];
      })
    )
  );
  md.push("Full values and the alias graph: `variables.json`.");
  md.push("");

  md.push("## Typography");
  md.push("");
  const typography = payload.typography?.tokens?.typography || {};
  md.push(
    mdTable(
      ["Token", "Font", "Size / line height", "Spacing", "CSS"],
      Object.entries(typography).map(([name, t]) => [
        name,
        `${t.fontFamily} ${t.fontWeight}`,
        `${t.fontSize} / ${t.lineHeight}`,
        t.letterSpacing,
        `\`${t.css}\``,
      ])
    )
  );
  md.push("Full tokens: `typography.json`.");
  md.push("");

  md.push("## Paint styles");
  md.push("");
  md.push(
    mdTable(
      ["Style", "Paints"],
      (ctx.paintStyles || []).map((s) => [
        s.name,
        (s.paints || []).map(paintLabel).join(", "),
      ])
    )
  );

  md.push("## Effect styles");
  md.push("");
  md.push(
    mdTable(
      ["Style", "Effects"],
      (ctx.effectStyles || []).map((s) => [s.name, (s.effects || []).join(", ")])
    )
  );

  md.push("## Components");
  md.push("");
  const comp = ctx.components || {};
  md.push(
    mdTable(
      ["Component", "Variants", "Props"],
      (comp.entries || []).map((c) => [
        c.name,
        c.variants != null ? String(c.variants) : "",
        c.props
          ? Object.entries(c.props)
              .map(([p, vals]) => `${p}: ${vals.join("/")}`)
              .join("; ")
          : "",
      ])
    )
  );
  if (comp.entriesTruncated) {
    md.push(`_Component list truncated — ${comp.componentSets} sets and ${comp.standaloneComponents} standalone components exist in total._`);
    md.push("");
  }

  md.push("## Summary");
  md.push("");
  md.push(`- Fonts used: ${(ctx.fonts || []).join(", ") || "—"}`);
  for (const [key, value] of Object.entries(ctx.counts || {})) {
    md.push(`- ${key}: ${value}`);
  }
  md.push("");

  return md.join("\n");
}

// File-context export: an inventory of the whole Figma file for Claude to
// reason about — written to <out>/_file-context/ as CONTEXT.md (readable
// overview) + variables.json + typography.json (full token data) + thumbs/.
async function writeContext(payload, outRoot, projectRoot) {
  if (!payload.context || typeof payload.context !== "object") {
    throw new Error("Payload has no context");
  }
  const contextDir = path.join(outRoot, CONTEXT_DIR);
  fs.rmSync(contextDir, { recursive: true, force: true });
  fs.mkdirSync(contextDir, { recursive: true });

  const written = [];
  const renames = new Map();

  for (const thumb of payload.thumbs || []) {
    const { outRel, absPath, note } = await writeAsset(
      contextDir,
      thumb.path,
      thumb.b64,
      "png",
      THUMB_MAX_DIMENSION
    );
    if (outRel !== thumb.path) renames.set(thumb.path, outRel);
    written.push(path.relative(projectRoot, absPath) + note);
  }

  for (const [name, data] of [
    ["variables.json", payload.variables],
    ["typography.json", payload.typography],
  ]) {
    if (!data || typeof data !== "object") continue;
    const filePath = path.join(contextDir, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    written.push(path.relative(projectRoot, filePath));
  }

  // Markdown links thumbs by bare (unquoted) path, so apply renames as plain
  // string replacement rather than applyRenames' quoted-JSON variant.
  let markdown = renderContextMd(payload);
  for (const [oldPath, newPath] of renames) {
    markdown = markdown.replaceAll(`(${oldPath})`, `(${newPath})`);
  }
  const mdPath = path.join(contextDir, "CONTEXT.md");
  fs.writeFileSync(mdPath, markdown);
  written.push(path.relative(projectRoot, mdPath));

  return { written, dirs: [path.relative(projectRoot, contextDir)] };
}

// Typography-only export: the file's local text styles as tokens, written to
// <out>/typography.json. Standalone (not under _file-context/) so refreshing
// text styles doesn't require a full file-context export, and so a context
// export doesn't wipe it.
async function writeTypography(payload, outRoot, projectRoot) {
  const typography = payload.typography;
  if (!typography || typeof typography !== "object") {
    throw new Error("Payload has no typography");
  }
  fs.mkdirSync(outRoot, { recursive: true });
  const filePath = path.join(outRoot, "typography.json");
  fs.writeFileSync(filePath, JSON.stringify(typography, null, 2) + "\n");
  return {
    written: [path.relative(projectRoot, filePath)],
    dirs: [path.relative(projectRoot, outRoot)],
  };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

// The Figma file identity: file key when the plugin can see it, else the file
// name. Used to remember which project each Figma file exports into.
function fileIdOf(payloadOrBody) {
  return payloadOrBody.fileKey || payloadOrBody.file || null;
}

export function startServer({ port = DEFAULT_PORT } = {}) {
  const server = http.createServer((req, res) => {
    // The plugin UI iframe has a null origin, so CORS must be permissive.
    // Safe because the server only listens on localhost and only writes into
    // folders the user registered through the picker or CLI.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/config") {
      const cfg = loadConfig();
      sendJson(res, 200, {
        defaultFolder: cfg.defaultFolder,
        recentFolders: cfg.recentFolders.filter((f) => fs.existsSync(f)),
        target: resolveTarget(cfg, url.searchParams.get("file")),
        sharp: !!sharp,
      });
      return;
    }

    if (req.method === "GET") {
      const cfg = loadConfig();
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(
        `Figma bridge is running. Default folder: ${cfg.defaultFolder ?? "(none — choose one in the plugin)"} (webp: ${sharp ? "on" : "off"})\n`
      );
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }

    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", async () => {
      let body = {};
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (raw.trim()) body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
      }

      try {
        if (url.pathname === "/pick") {
          const folder = await pickFolder();
          if (!folder) {
            sendJson(res, 200, { canceled: true });
            return;
          }
          const cfg = loadConfig();
          const abs = registerFolder(cfg, folder);
          cfg.defaultFolder = abs;
          const fileId = fileIdOf(body);
          if (fileId) cfg.fileMap[fileId] = abs;
          saveConfig(cfg);
          console.log(`Registered export folder: ${abs}` + (fileId ? ` (for "${fileId}")` : ""));
          sendJson(res, 200, { folder: abs });
          return;
        }

        if (url.pathname === "/select") {
          const cfg = loadConfig();
          const folder = typeof body.folder === "string" ? body.folder : null;
          // Only previously registered folders are selectable — see resolveTarget.
          if (!folder || !cfg.recentFolders.includes(folder)) {
            sendJson(res, 403, { error: "Folder not registered — use the folder picker" });
            return;
          }
          registerFolder(cfg, folder);
          cfg.defaultFolder = folder;
          const fileId = fileIdOf(body);
          if (fileId) cfg.fileMap[fileId] = folder;
          saveConfig(cfg);
          sendJson(res, 200, { folder });
          return;
        }

        if (
          url.pathname === "/export" ||
          url.pathname === "/context" ||
          url.pathname === "/typography"
        ) {
          const cfg = loadConfig();
          const target = resolveTarget(cfg, fileIdOf(body));
          if (!target) {
            sendJson(res, 400, {
              error: "No export folder chosen — click “Choose folder…” in the plugin",
            });
            return;
          }
          const handlers = {
            "/export": [writeExport, "Export"],
            "/context": [writeContext, "File context"],
            "/typography": [writeTypography, "Typography styles"],
          };
          const [handler, label] = handlers[url.pathname];
          const bootstrap = bootstrapProject(target);
          const result = await handler(body, path.join(target, OUT_DIR), target);
          console.log(
            `[${new Date().toLocaleTimeString()}] ${label} received → ${target} — ${result.written.length} files:`
          );
          for (const note of bootstrap) console.log(`  ${note}`);
          for (const f of result.written) console.log(`  ${f}`);
          sendJson(res, 200, { ...result, target, bootstrap });
          return;
        }

        res.writeHead(404).end();
      } catch (e) {
        console.error(`${url.pathname} failed:`, e.message);
        sendJson(res, 400, { error: e.message });
      }
    });
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use — the bridge is probably already running.\n` +
          `Check with:  curl http://localhost:${port}\n` +
          `If it responds, just use the running one. To replace it:  kill $(lsof -ti :${port})`
      );
      process.exit(1);
    }
    throw e;
  });

  server.listen(port, "127.0.0.1", () => {
    const cfg = loadConfig();
    console.log(`Figma bridge listening on http://localhost:${port}`);
    console.log(
      `Export folder: ${cfg.defaultFolder ?? "(none yet — pick one in the plugin)"} — switch per file from the plugin UI`
    );
    console.log(
      `PNG → WebP optimization: ${sharp ? `on (q${WEBP_QUALITY}, max ${MAX_DIMENSION}px)` : "off — sharp unavailable"}`
    );
  });

  return server;
}
