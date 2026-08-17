/**
 * Error translation for the TheTerms REST API v1.
 *
 * Responsibility: "interpret the result" — given a `Response` from a failed
 * REST call, produce a `CallToolResult` shaped for the calling model
 * (`{ isError: true, content: [...] }`), per design.md D4. This file makes
 * no network calls itself; it only reads a `Response` it's handed.
 *
 * Per D4, REST-level failures (401, 429, 4xx/5xx, malformed bodies) are
 * *tool-execution* errors, not protocol errors: they must never throw
 * `McpError` or let an exception escape, since that would conflate "the
 * tool ran and got a bad answer" with a transport/protocol fault. Genuine
 * protocol-shape problems (e.g. malformed incoming MCP requests) are
 * handled by the SDK before a tool handler ever runs, and are out of scope
 * here.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** The REST API's own error body shape: `{ error: { code, message } }`. */
interface RestErrorBody {
  error: {
    code?: unknown;
    message?: unknown;
  };
}

function isRestErrorBody(value: unknown): value is RestErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null;
}

function toolResult(text: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text }],
  };
}

/** Clear, actionable fallback messages for statuses the REST body doesn't explain. */
function fallbackMessage(status: number): string {
  if (status === 401) {
    return "TheTerms API authentication failed: the API key is missing, invalid, or has been revoked. Check the THETERMS_API_KEY environment variable.";
  }
  if (status === 429) {
    return "TheTerms API rate limit exceeded. This request is retryable — wait a moment and try again.";
  }
  if (status >= 500) {
    return `TheTerms API returned a server error (HTTP ${status}). This may be transient — retrying later may help.`;
  }
  return `TheTerms API request failed (HTTP ${status}).`;
}

/**
 * Translates a failed REST API `Response` into a `CallToolResult`. Intended
 * to be called whenever `response.ok` is `false` (though it degrades
 * gracefully — status-based fallback messaging only kicks in when the body
 * doesn't carry a legible `error.message` — if called on a 2xx response
 * with no matching body shape).
 *
 * Never throws: body parsing failures (non-JSON, empty body, unexpected
 * shape) are caught internally and mapped to a generic, legible
 * status-based message rather than leaking a raw parse error.
 */
export async function toErrorResult(response: Response): Promise<CallToolResult> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (isRestErrorBody(body) && typeof body.error.message === "string" && body.error.message.length > 0) {
    return toolResult(body.error.message);
  }

  return toolResult(fallbackMessage(response.status));
}
