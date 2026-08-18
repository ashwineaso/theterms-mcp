import { afterEach, describe, expect, it, vi } from "vitest";
import { TheTermsConfigError } from "../client.js";

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
  afterEach(() => {
    vi.resetAllMocks();
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

  it("lets a genuine (non-config) thrown error propagate rather than swallowing it", async () => {
    vi.mocked(theTermsFetch).mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));

    await expect(callTheTermsApi({ method: "GET", path: "/containers" })).rejects.toThrow(
      "ECONNREFUSED"
    );
  });
});
