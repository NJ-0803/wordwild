// Point the extension at a new site address in one step. Usage: node set-domain.mjs https://wordwild.app
// Changes the default address, the permission it asks for, the website bridge and the store listing text. Nothing else.
import { readFileSync, writeFileSync } from "node:fs";
const OLD = "https://wordwild-seven.vercel.app";
const next = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(next)) { console.error("Give the new address, for example: node set-domain.mjs https://wordwild.app"); process.exit(1); }
const files = ["manifest.json", "background.js", "options.js", "options.html", "popup.html", "store/LISTING.md", "README.md"];
for (const f of files) { const s = readFileSync(f, "utf8"); if (s.includes(OLD)) { writeFileSync(f, s.split(OLD).join(next)); console.log("updated", f); } }
console.log(`\nNow bump "version" in manifest.json, run: node build-store.mjs, and upload the new zip to the Chrome Web Store.`);
