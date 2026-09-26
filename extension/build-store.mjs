// Builds the Chrome Web Store package: node build-store.mjs   ->   dist/wordwild-extension-<version>.zip
// The store build differs from the developer build in two ways only: it cannot talk to localhost, and it cannot be pointed at other servers
// (no extra host permissions), so a reviewer sees the smallest permission set that makes it work.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const FILES = ["background.js", "content.js", "shared.js", "popup.html", "popup.js", "options.html", "options.js", "ui.css", "icons"];
const m = JSON.parse(readFileSync("manifest.json", "utf8"));
m.host_permissions = m.host_permissions.filter(h => h.startsWith("https://"));
delete m.optional_host_permissions;
const out = join("dist", "package"); rmSync("dist", { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(f, join(out, f), { recursive: true });
writeFileSync(join(out, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
const zip = join("dist", `wordwild-extension-${m.version}.zip`);
execFileSync("zip", ["-qr", `../${zip.split("/")[1]}`, "."], { cwd: out });
// The website offers the same package as a do-it-yourself install for people who do not use the store (web/src/app/extension).
mkdirSync("../web/public", { recursive: true }); cpSync(zip, "../web/public/wordwild-extension.zip");
const list = []; const walk = (d, p = "") => { for (const n of readdirSync(d)) { const f = join(d, n); statSync(f).isDirectory() ? walk(f, p + n + "/") : list.push(p + n); } }; walk(out);
console.log(`Built ${zip}\nFiles (${list.length}): ${list.sort().join(", ")}\nPermissions: ${JSON.stringify(m.permissions)}  Hosts: ${JSON.stringify(m.host_permissions)}  Optional hosts: ${JSON.stringify(m.optional_host_permissions ?? [])}`);
