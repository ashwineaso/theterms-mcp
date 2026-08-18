/**
 * Aggregates and registers all 10 approved MCP tools.
 *
 * Per the "Tool Exposure" spec requirement, the server must expose exactly
 * these 10 tools and no others — no webhook/template tools, no DELETE
 * operations, no secondary lifecycle actions (duplicate/archive/new-draft).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContainerTool, listContainersTool } from "./containers.js";
import {
  createDocumentTool,
  getDocumentTool,
  listDocumentsTool,
  publishDocumentTool,
  updateDraftTool,
} from "./documents.js";
import {
  getSigningRequestTool,
  listSigningRequestsTool,
  sendSigningRequestTool,
} from "./signing-requests.js";

/** Registers all 10 tools on the given server instance. */
export function registerAllTools(server: McpServer): void {
  server.registerTool(listContainersTool.name, listContainersTool.config, listContainersTool.handler);
  server.registerTool(
    createContainerTool.name,
    createContainerTool.config,
    createContainerTool.handler
  );
  server.registerTool(listDocumentsTool.name, listDocumentsTool.config, listDocumentsTool.handler);
  server.registerTool(getDocumentTool.name, getDocumentTool.config, getDocumentTool.handler);
  server.registerTool(
    createDocumentTool.name,
    createDocumentTool.config,
    createDocumentTool.handler
  );
  server.registerTool(updateDraftTool.name, updateDraftTool.config, updateDraftTool.handler);
  server.registerTool(
    publishDocumentTool.name,
    publishDocumentTool.config,
    publishDocumentTool.handler
  );
  server.registerTool(
    sendSigningRequestTool.name,
    sendSigningRequestTool.config,
    sendSigningRequestTool.handler
  );
  server.registerTool(
    getSigningRequestTool.name,
    getSigningRequestTool.config,
    getSigningRequestTool.handler
  );
  server.registerTool(
    listSigningRequestsTool.name,
    listSigningRequestsTool.config,
    listSigningRequestsTool.handler
  );
}

/** The 10 approved tool names, in registration order — used by tests to verify exposure. */
export const APPROVED_TOOL_NAMES = [
  listContainersTool.name,
  createContainerTool.name,
  listDocumentsTool.name,
  getDocumentTool.name,
  createDocumentTool.name,
  updateDraftTool.name,
  publishDocumentTool.name,
  sendSigningRequestTool.name,
  getSigningRequestTool.name,
  listSigningRequestsTool.name,
] as const;
