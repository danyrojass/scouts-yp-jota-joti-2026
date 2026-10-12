// Vercel serverless entry.
//
// Vercel packages this file (and everything it `require`s) into a single
// Function and forwards every /api/* request here. We re-use the compiled
// Express app from server/dist, which is built with `tsc` + `tsc-alias` so the
// emitted JS has no path aliases to resolve at runtime.
//
// The request path is preserved by Vercel, so Express keeps matching its
// absolute routes (/api/health, /api/v1/..., ...).
const { createApp } = require("../server/dist/app.js");

module.exports = createApp();
