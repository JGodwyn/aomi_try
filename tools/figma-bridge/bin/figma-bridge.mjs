#!/usr/bin/env node
// figma-bridge CLI.
//   figma-bridge start [--port 4411]
//   figma-bridge plugin build [--port 4411]
//   figma-bridge plugin path

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_DIR = path.join(PKG_ROOT, "plugin");
const require = createRequire(import.meta.url);

const HELP = `figma-bridge — Figma → repo bridge (no REST API, no rate limits)

Usage:
  figma-bridge start [--port 4411]
      Run the bridge server. One server handles every project: pick the
      export folder from the plugin UI in Figma (remembered per Figma file,
      stored in ~/.figma-bridge/config.json). Exports land in that folder's
      design-sync/. Starting from a project directory registers it as a
      selectable folder.

  figma-bridge plugin build [--port 4411]
      Recompile the Figma plugin (plugin/code.ts → code.js). With --port,
      also rewrites the port baked into manifest.json and ui.html.

  figma-bridge plugin path
      Print the plugin manifest path, for Figma desktop →
      Plugins → Development → Import plugin from manifest…
`;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`Invalid port: ${value}`);
  }
  return port;
}

// The port is baked into the plugin at build time — Figma's manifest
// allowlists exact origins, so it can't be a runtime setting.
function retargetPluginPort(port) {
  const manifestPath = path.join(PLUGIN_DIR, "manifest.json");
  const uiPath = path.join(PLUGIN_DIR, "ui.html");
  for (const file of [manifestPath, uiPath]) {
    const src = fs.readFileSync(file, "utf8");
    const out = src.replace(/localhost:\d+/g, `localhost:${port}`);
    if (out !== src) fs.writeFileSync(file, out);
  }
  console.log(`Plugin retargeted to http://localhost:${port}`);
}

const [command, ...rest] = process.argv.slice(2);

if (!command || command === "help" || command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(command ? 0 : 1);
}

if (command === "start") {
  const { values } = parseArgs({
    args: rest,
    options: {
      port: { type: "string" },
    },
  });
  const { startServer, DEFAULT_PORT, loadConfig, saveConfig, registerFolder } =
    await import(path.join(PKG_ROOT, "server.mjs"));

  // Old habit support: starting from a project root registers that project as
  // a selectable export folder (and the default, if none is set yet).
  const cwd = process.cwd();
  const looksLikeProject =
    cwd !== PKG_ROOT &&
    (fs.existsSync(path.join(cwd, ".git")) || fs.existsSync(path.join(cwd, "package.json")));
  if (looksLikeProject) {
    const cfg = loadConfig();
    if (!cfg.recentFolders.includes(cwd)) {
      registerFolder(cfg, cwd);
      saveConfig(cfg);
      console.log(`Registered ${cwd} as an export folder`);
    }
  }

  startServer({
    port: values.port ? parsePort(values.port) : DEFAULT_PORT,
  });
} else if (command === "plugin") {
  const [sub, ...pluginRest] = rest;

  if (sub === "path") {
    console.log(path.join(PLUGIN_DIR, "manifest.json"));
  } else if (sub === "build") {
    const { values } = parseArgs({
      args: pluginRest,
      options: { port: { type: "string" } },
    });
    if (values.port) retargetPluginPort(parsePort(values.port));
    const tsc = require.resolve("typescript/lib/tsc.js");
    const result = spawnSync(
      process.execPath,
      [tsc, "-p", path.join(PLUGIN_DIR, "tsconfig.json")],
      { stdio: "inherit" }
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
    console.log(`Built ${path.join(PLUGIN_DIR, "code.js")}`);
  } else {
    fail(`Unknown plugin subcommand: ${sub ?? "(none)"}\n\n${HELP}`);
  }
} else {
  fail(`Unknown command: ${command}\n\n${HELP}`);
}
