// Lets plain Node scripts resolve the "@core" alias the same way Next/TypeScript do.
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
