// Run a script that imports the app's own modules under plain `node`:
//
//   node --import ./tools/node-app.mjs tools/my-audit.mjs
//
// Next resolves extensionless relative imports at build time; Node does not,
// so this registers a resolver that does the same thing. Used by the data
// audit, which checks the real model against SQL instead of against a
// screenshot.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./resolve-js.mjs", pathToFileURL("./tools/"));
