import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./rest-tool.js", async () => {
  const actual = await vi.importActual<typeof import("./rest-tool.js")>("./rest-tool.js");
  return {
    ...actual,
    callTheTermsApi: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] }),
  };
});

const { callTheTermsApi } = await import("./rest-tool.js");
const { createDocumentTool, publishDocumentTool, updateDraftTool } = await import("./documents.js");

describe("document tool handlers build the right TheTermsRequest", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("create_document sends a POST with the full parsed input as the body", async () => {
    const args = { containerId: "11111111-1111-1111-1111-111111111111", name: "MSA", description: "x" };

    await createDocumentTool.handler(args);

    expect(callTheTermsApi).toHaveBeenCalledWith({
      method: "POST",
      path: "/documents",
      body: args,
    });
  });

  it("update_draft PUTs to /documents/:id/draft, using `id` in the path and excluding it from the body", async () => {
    const args = {
      id: "22222222-2222-2222-2222-222222222222",
      content: { clauses: [] },
      settings: { expiry_days: 7, redirect_url: null },
    };

    await updateDraftTool.handler(args);

    expect(callTheTermsApi).toHaveBeenCalledWith({
      method: "PUT",
      path: "/documents/22222222-2222-2222-2222-222222222222/draft",
      body: { content: args.content, settings: args.settings },
    });
    // The id must not leak into the body — it's a path param on the REST route.
    const call = vi.mocked(callTheTermsApi).mock.calls[0]?.[0];
    expect(call?.body).not.toHaveProperty("id");
  });

  it("publish_document POSTs to /documents/:id/publish with no request body", async () => {
    const args = { id: "33333333-3333-3333-3333-333333333333" };

    await publishDocumentTool.handler(args);

    expect(callTheTermsApi).toHaveBeenCalledWith({
      method: "POST",
      path: "/documents/33333333-3333-3333-3333-333333333333/publish",
    });
    const call = vi.mocked(callTheTermsApi).mock.calls[0]?.[0];
    expect(call?.body).toBeUndefined();
  });
});
