import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "./index.js";
import { APPROVED_TOOL_NAMES } from "./tools/index.js";

/**
 * "Tool Exposure" spec requirement: `tools/list` must return exactly the 10
 * approved tools, no more, no less — no webhook/template tools, no DELETE
 * operations, no secondary lifecycle actions (duplicate/archive/new-draft).
 *
 * This drives a real `tools/list` request through the actual MCP protocol
 * layer (via a linked pair of in-memory transports + a real `Client`),
 * rather than just introspecting the server's internal registry, so the
 * check exercises the same code path a real MCP client would.
 */
describe("tools/list exposure", () => {
  it("returns exactly the 10 approved tool names, no more, no less", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const result = await client.listTools();
    const names = result.tools.map((tool) => tool.name).sort();

    expect(names).toEqual([...APPROVED_TOOL_NAMES].sort());
    expect(names).toHaveLength(10);

    // Explicitly assert none of the deliberately-excluded tool families snuck in.
    const excludedPatterns = [
      /webhook/i,
      /template/i,
      /duplicate/i,
      /archive/i,
      /new-draft|new_draft/i,
      /delete/i,
    ];
    for (const name of names) {
      for (const pattern of excludedPatterns) {
        expect(name).not.toMatch(pattern);
      }
    }

    await client.close();
    await server.close();
  });

  it("gives update_draft's description an explicit get_document-first instruction (Draft Update Data-Loss Guard)", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const result = await client.listTools();
    const updateDraft = result.tools.find((tool) => tool.name === "update_draft");

    expect(updateDraft).toBeDefined();
    expect(updateDraft?.description).toMatch(/get_document/);
    expect(updateDraft?.description?.toLowerCase()).toMatch(/must call get_document/);

    await client.close();
    await server.close();
  });

  it("gives send_signing_request's description explicit versionId guidance", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const result = await client.listTools();
    const sendSigningRequest = result.tools.find((tool) => tool.name === "send_signing_request");

    expect(sendSigningRequest).toBeDefined();
    expect(sendSigningRequest?.description).toMatch(/versionId/);
    expect(sendSigningRequest?.description).toMatch(/get_document/);

    await client.close();
    await server.close();
  });
});
