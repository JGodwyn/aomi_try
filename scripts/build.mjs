import { cpSync, mkdirSync, rmSync } from "node:fs";

const copy = (from, to) => cpSync(from, to, { recursive: true });

rmSync("dist", { force: true, recursive: true });
mkdirSync("dist/vendor/motion", { recursive: true });

copy("index.html", "dist/index.html");
copy("src", "dist/src");
copy("public", "dist");
copy("design-tokens", "dist/design-tokens");
copy("node_modules/motion/dist/motion.js", "dist/vendor/motion/motion.js");
