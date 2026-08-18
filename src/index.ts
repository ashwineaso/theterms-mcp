#!/usr/bin/env node
/**
 * `theterms-mcp` server entrypoint.
 *
 * Wires the 10 approved tools (src/tools/index.ts) into an `McpServer` and
 * serves them over stdio — per design.md D2, stdio is the only transport
 * this package supports (no hosted/remote component).
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

/** Builds a fully-configured server instance (all 10 tools registered) without connecting a transport. */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "theterms-mcp",
    version: "0.0.0",
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
function isMainModule(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    console.error("theterms-mcp: fatal error starting server:", error);
    process.exitCode = 1;
  });
}
