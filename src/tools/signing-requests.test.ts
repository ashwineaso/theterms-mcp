import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./rest-tool.js", async () => {
  const actual = await vi.importActual<typeof import("./rest-tool.js")>("./rest-tool.js");
  return {
    ...actual,
    callTheTermsApi: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  };
});

const { callTheTermsApi } = await import("./rest-tool.js");
const { listSigningRequestsTool, sendSigningRequestTool } = await import("./signing-requests.js");

describe("signing-request tool handlers build the right TheTermsRequest", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("send_signing_request POSTs the parsed input (versionId, not documentId) as the body", async () => {
    const args = {
      versionId: "44444444-4444-4444-4444-444444444444",
      signerName: "Ada Lovelace",
      signerEmail: "ada@example.com",
    };

    await sendSigningRequestTool.handler(args);

    expect(callTheTermsApi).toHaveBeenCalledWith({
      method: "POST",
      path: "/signing-requests",
      body: args,
    });
  });

  it("list_signing_requests GETs with all filter/pagination fields passed through as query params", async () => {
    const args = {
      status: "PENDING" as const,
      versionId: "55555555-5555-5555-5555-555555555555",
      search: "acme",
      dateRange: "30d" as const,
      sortBy: "created_at" as const,
      sortDir: "desc" as const,
      limit: 10,
      offset: 20,
    };

    await listSigningRequestsTool.handler(args);

    expect(callTheTermsApi).toHaveBeenCalledWith({
      method: "GET",
      path: "/signing-requests",
      searchParams: {
        status: "PENDING",
        versionId: "55555555-5555-5555-5555-555555555555",
        search: "acme",
        dateRange: "30d",
        sortBy: "created_at",
        sortDir: "desc",
        limit: 10,
        offset: 20,
      },
    });
  });
});
