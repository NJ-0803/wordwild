// Lets plain Node scripts resolve what Next/TypeScript resolve: the "@core" alias and extensionless relative imports.
export async function resolve(specifier, context, next) {
  if (specifier === "@core") return next(new URL("../../core/src/index.ts", import.meta.url).href, context);
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    try { return await next(specifier + ".ts", context); } catch { /* fall through */ }
  }
  return next(specifier, context);
}
