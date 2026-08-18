import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TheTermsConfigError } from "../client.js";

const ORIGINAL_ENV = { ...process.env };

vi.mock("../client.js", async () => {
  const actual = await vi.importActual<typeof import("../client.js")>("../client.js");
  return {
    ...actual,
    theTermsFetch: vi.fn(),
  };
});

const { theTermsFetch } = await import("../client.js");
const { callTheTermsApi } = await import("./rest-tool.js");

describe("callTheTermsApi", () => {
  beforeEach(() => {
    process.env.THETERMS_API_KEY = "test-key";
    process.env.THETERMS_API_BASE_URL = "https://api.example.test/api/v1";
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("routes a successful (ok) response to a success CallToolResult wrapping the JSON body as text", async () => {
    const body = { data: { id: "abc-123", name: "Test Container" } };
    vi.mocked(theTermsFetch).mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const result = await callTheTermsApi({ method: "GET", path: "/containers" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(body) }]);
  });

  it("routes a non-ok response through errors.ts's toErrorResult (surfaces the REST error message)", async () => {
    vi.mocked(theTermsFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Document not found." } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await callTheTermsApi({ method: "GET", path: "/documents/does-not-exist" });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Document not found." }]);
  });

  it("catches a TheTermsConfigError and surfaces it as isError:true instead of throwing", async () => {
    vi.mocked(theTermsFetch).mockRejectedValue(
      new TheTermsConfigError("THETERMS_API_KEY is not set. Set it in the environment...")
    );

    const result = await callTheTermsApi({ method: "GET", path: "/containers" });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "THETERMS_API_KEY is not set. Set it in the environment..." },
    ]);
  });

  it("Important #3: turns a genuine (non-config) network failure into an isError result with method, URL, and cause code — not a bare 'fetch failed'", async () => {
    const networkError = new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    vi.mocked(theTermsFetch).mockRejectedValue(networkError);

    const result = await callTheTermsApi({ method: "GET", path: "/containers" });

    expect(result.isError).toBe(true);
    const text = result.content?.[0];
    expect(text).toMatchObject({ type: "text" });
    const message = (text as { text: string }).text;
    expect(message).toContain("GET");
    expect(message).toContain("https://api.example.test/api/v1/containers");
    expect(message).toContain("ECONNREFUSED");
    // No longer a bare, unhelpful two-word string.
    expect(message).not.toBe("fetch failed");
  });

  it("still produces an isError result (with method + URL, but no cause suffix) when the thrown error has no cause.code", async () => {
    vi.mocked(theTermsFetch).mockRejectedValue(new Error("something went wrong"));

    const result = await callTheTermsApi({ method: "POST", path: "/documents" });

    expect(result.isError).toBe(true);
    const message = (result.content?.[0] as { text: string }).text;
    expect(message).toContain("POST");
    expect(message).toContain("https://api.example.test/api/v1/documents");
  });

  it("Minor #7: a 200 response with a non-JSON body returns a legible isError instead of leaking a raw SyntaxError", async () => {
    vi.mocked(theTermsFetch).mockResolvedValue(
      new Response("<html>hi</html>", { status: 200, headers: { "Content-Type": "text/html" } })
    );

    const result = await callTheTermsApi({ method: "GET", path: "/containers" });

    expect(result.isError).toBe(true);
    const message = (result.content?.[0] as { text: string }).text;
    expect(message).toBe("TheTerms API returned a non-JSON response (HTTP 200).");
    expect(message).not.toMatch(/Unexpected token/);
  });
});
