#!/usr/bin/env node
/**
 * `theterms-mcp` server entrypoint.
 *
 * Wires the 10 approved tools (src/tools/index.ts) into an `McpServer` and
 * serves them over stdio — per design.md D2, stdio is the only transport
 * this package supports (no hosted/remote component).
 */
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

/**
 * The package's own version, read from `package.json` at runtime rather
 * than hardcoded — reported to every MCP client in the `initialize`
 * handshake (`serverInfo.version`), so client-side logs can distinguish
 * which build they're talking to (e.g. 0.1.0, the symlink-broken release,
 * from 0.1.1+, the fix). `package.json` sits one directory up from this
 * file both in `src/` (source) and in `dist/` (built, since `tsc`'s
 * `rootDir`/`outDir` preserve the same relative layout), and it's always
 * included in the published tarball (`files: ["dist"]` plus npm's implicit
 * inclusion of `package.json`), so this is safe in every run mode.
 */
const packageVersion = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

/** Builds a fully-configured server instance (all 10 tools registered) without connecting a transport. */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "theterms-mcp",
    version: packageVersion,
  });
  registerAllTools(server);
  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-start when this file is run directly as the CLI entrypoint —
// not when imported (e.g. by tests importing `createServer`).
//
// A raw string comparison of `import.meta.url` vs `process.argv[1]` is
// symlink-unsafe: npm's `bin` mechanism runs this file via a symlink
// (e.g. `node_modules/.bin/theterms-mcp`). Node passes the *symlink* path
// through as `process.argv[1]` unresolved, but resolves `import.meta.url`
// to the *real* path the symlink points at — so the two strings never
// match and the server silently never starts. Resolving both sides to
// their real filesystem path before comparing fixes this.
//
// Exported (not just a local closure) so `index.test.ts` can regression-test
// this exact bug with a real `fs.symlinkSync` fixture — this is the one
// defect in this codebase that already shipped broken to npm once
// (0.1.0, fixed in 0d68fd5), so it needs a standing guard, not just a
// throwaway manual repro.
export function isMainModule(metaUrl: string, argv1: string | undefined): boolean {
  if (argv1 === undefined) {
    return false;
  }
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argv1);
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((error: unknown) => {
    console.error("theterms-mcp: fatal error starting server:", error);
    process.exitCode = 1;
  });
}
