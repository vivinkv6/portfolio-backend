import fs from "fs";
import path from "path";

function resolveSessionAuthPath() {
  const cwd = process.cwd();
  const candidatePaths = [
    path.join(cwd, "node_modules", "@strapi", "admin", "dist", "server", "shared", "utils", "session-auth.js"),
    path.join(cwd, "..", "node_modules", "@strapi", "admin", "dist", "server", "shared", "utils", "session-auth.js"),
  ];

  const resolvedPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(
      `Unable to locate Strapi admin session-auth helper. Checked: ${candidatePaths.join(", ")}`
    );
  }

  return resolvedPath;
}

// Load Strapi's internal admin session helpers from the installed file path.
// Importing through the package name is blocked by the package exports field.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionAuth = require(resolveSessionAuthPath());

export = sessionAuth;
