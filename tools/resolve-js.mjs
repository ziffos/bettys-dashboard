// Lets a plain `node` run the app's extensionless ESM imports (Next resolves
// them at build time; Node does not).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
export function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    for (const cand of [`${base}.js`, `${base}/index.js`]) {
      if (existsSync(cand)) return next(pathToFileURL(cand).href, context);
    }
  }
  return next(specifier, context);
}
