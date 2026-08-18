/**
 * Shared plumbing for the 10 REST-backed MCP tools.
 *
 * Every tool handler in `containers.ts`/`documents.ts`/`signing-requests.ts`
 * is a thin, uniform wrapper: build a `TheTermsRequest` from the tool's
 * parsed input, call `theTermsFetch` (client.ts), and convert the outcome
 * into a `CallToolResult` via `callTheTermsApi` below. Per-tool files own
 * *what* request to build (method/path/body/query) and their description
 * text; this file owns the one shared piece of real logic: turning a
 * `Response` (or a config failure) into the right `CallToolResult` shape.
 */
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { TheTermsConfigError, theTermsFetch, type TheTermsRequest } from "../client.js";
import { toErrorResult } from "../errors.js";

/**
 * Performs one REST v1 call and converts the outcome into a
 * `CallToolResult`. Never throws:
 *  - `TheTermsConfigError` (missing `THETERMS_API_KEY`/`THETERMS_API_BASE_URL`,
 *    thrown by `theTermsFetch` before any network call happens) is caught
 *    here and surfaced as `{ isError: true }` with the config error's own
 *    clear message — per the spec's "API Key Authentication" requirement,
 *    this must never be a process crash or uncaught exception.
 *  - A non-ok REST response is handed to `errors.ts`'s `toErrorResult`.
 *  - A success response's JSON body is wrapped as `CallToolResult` text
 *    content (`JSON.stringify`), uniformly across all 10 tools.
 *
 * Genuine network-level failures (DNS, connection refused, etc.) are
 * allowed to propagate — the SDK's own request handler catches any
 * exception a tool callback throws and converts it into an `isError`
 * result too, so this never crashes the server process either.
 */
export async function callTheTermsApi(request: TheTermsRequest): Promise<CallToolResult> {
  let response: Response;
  try {
    response = await theTermsFetch(request);
  } catch (error) {
    if (error instanceof TheTermsConfigError) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
    throw error;
  }

  if (!response.ok) {
    return toErrorResult(response);
  }

  const data: unknown = await response.json();
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/**
 * Annotations for `list_*`/`get_*` tools: they never mutate anything, and
 * repeating the same call has the same effect (idempotent by nature).
 */
export const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
};

/**
 * Annotations for `create_*`/`send_signing_request`: mutating, and each
 * call creates a brand-new resource — calling twice is not equivalent to
 * calling once.
 */
export const CREATE_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
};

/**
 * Annotations for `update_draft`/`publish_document`: mutating, but
 * repeating the same call has the same effect (replaces the draft with the
 * same content again; publishing an already-published version is a no-op
 * from the caller's perspective).
 */
export const IDEMPOTENT_MUTATION_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
};
