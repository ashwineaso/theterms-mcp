/**
 * Thin fetch wrapper for the TheTerms REST API v1.
 *
 * Responsibility: "make the HTTP call" — reads request config, attaches
 * auth, performs the fetch, and returns the raw `Response`. It does NOT
 * interpret success/failure: that's `errors.ts`'s job (see design.md D4).
 * Keeping the split this way means a REST failure never gets silently
 * swallowed here, and this file never has to know what a `CallToolResult`
 * looks like.
 */

/** HTTP methods used by the REST v1 tool set (no DELETE — out of scope, see design.md Non-Goals). */
export type TheTermsHttpMethod = "GET" | "POST" | "PUT";

export interface TheTermsRequest {
  /** HTTP method for the request. */
  method: TheTermsHttpMethod;
  /** Path relative to the API base URL, e.g. "/containers" or "/documents/123/draft". Leading slash optional. */
  path: string;
  /** JSON-serializable request body. Omit for GET requests or bodyless calls. */
  body?: unknown;
  /** Query string parameters. `undefined` values are omitted. */
  searchParams?: Record<string, string | number | boolean | undefined>;
}

/**
 * Thrown when required configuration (API key or base URL) is missing at
 * call time. This is a *configuration* failure, not a REST domain failure —
 * it is deliberately NOT translated into a `CallToolResult` here; that
 * remains errors.ts's concern for REST responses. Callers (Task 5's tool
 * handlers) are expected to catch this and surface it to the calling model.
 */
export class TheTermsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TheTermsConfigError";
  }
}

/**
 * Reads `THETERMS_API_BASE_URL` and `THETERMS_API_KEY` from `process.env`
 * at call time (not module load time), so tests can set/unset them per
 * test without any module-reload gymnastics, and so a long-running server
 * process picks up env changes made before each tool call rather than
 * caching a stale value from startup.
 */
function readConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.THETERMS_API_KEY;
  if (!apiKey) {
    throw new TheTermsConfigError(
      "THETERMS_API_KEY is not set. Set it in the environment before starting the TheTerms MCP server — see the package README for setup instructions."
    );
  }

  const baseUrl = process.env.THETERMS_API_BASE_URL;
  if (!baseUrl) {
    throw new TheTermsConfigError(
      "THETERMS_API_BASE_URL is not set. Set it in the environment before starting the TheTerms MCP server — see the package README for setup instructions."
    );
  }

  return { apiKey, baseUrl };
}

function buildUrl(baseUrl: string, path: string, searchParams?: TheTermsRequest["searchParams"]): URL {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

/**
 * Resolves the full target URL (base URL + path + query) for a request,
 * without performing the fetch. Exposed so callers (`rest-tool.ts`'s
 * network-error diagnostics) can report *where* a request was headed
 * without duplicating URL-building logic here. Safe to surface: the API
 * key is sent only as a header (`X-Api-Key`), never part of the URL.
 *
 * Throws `TheTermsConfigError` under the same conditions as
 * `theTermsFetch` (missing `THETERMS_API_KEY`/`THETERMS_API_BASE_URL`).
 */
export function resolveRequestUrl(request: TheTermsRequest): string {
  const { baseUrl } = readConfig();
  return buildUrl(baseUrl, request.path, request.searchParams).toString();
}

/**
 * Performs a single REST v1 request. Returns the raw `Response` — the
 * caller is responsible for checking `response.ok` and, on failure,
 * handing the response to `errors.ts` for translation into a
 * `CallToolResult`. This function never inspects the response body.
 *
 * Throws `TheTermsConfigError` if `THETERMS_API_KEY` or
 * `THETERMS_API_BASE_URL` is missing. Lets `fetch`'s own network-level
 * errors (e.g. DNS failure, connection refused) propagate as-is.
 */
export async function theTermsFetch(request: TheTermsRequest): Promise<Response> {
  const { apiKey, baseUrl } = readConfig();
  const url = buildUrl(baseUrl, request.path, request.searchParams);

  const hasBody = request.body !== undefined;

  return fetch(url, {
    method: request.method,
    headers: {
      "X-Api-Key": apiKey,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });
}
