import { cpSync, mkdirSync, rmSync } from "node:fs";

const copy = (from, to) => cpSync(from, to, { recursive: true });

rmSync("dist", { force: true, recursive: true });
mkdirSync("dist/vendor/dialkit", { recursive: true });
mkdirSync("dist/vendor/motion", { recursive: true });

copy("index.html", "dist/index.html");
copy("src", "dist/src");
copy("design-tokens", "dist/design-tokens");
copy("design-sync", "dist/design-sync");
copy("node_modules/motion/dist/motion.js", "dist/vendor/motion/motion.js");
copy(
  "node_modules/dialkit/dist/vanilla/browser.global.js",
  "dist/vendor/dialkit/browser.global.js",
);
copy(
  "node_modules/dialkit/dist/vanilla/styles.css",
  "dist/vendor/dialkit/styles.css",
);
