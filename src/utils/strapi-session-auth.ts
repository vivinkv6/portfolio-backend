import path from "path";

const sessionAuthPath = path.join(
  process.cwd(),
  "node_modules",
  "@strapi",
  "admin",
  "dist",
  "server",
  "shared",
  "utils",
  "session-auth.js"
);

// Load Strapi's internal admin session helpers from the local install path.
// Importing through the package name is blocked by the package exports field.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionAuth = require(sessionAuthPath);

export = sessionAuth;
