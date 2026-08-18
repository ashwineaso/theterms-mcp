#!/usr/bin/env node
/**
 * `theterms-mcp` server entrypoint.
 *
 * Wires the 10 approved tools (src/tools/index.ts) into an `McpServer` and
 * serves them over stdio — per design.md D2, stdio is the only transport
 * this package supports (no hosted/remote component).
 */
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
const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("theterms-mcp: fatal error starting server:", error);
    process.exitCode = 1;
  });
}
