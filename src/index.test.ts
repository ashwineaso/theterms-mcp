import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, isMainModule } from "./index.js";
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

  it("also warns update_draft's description that `settings` is replaced in full, not merged", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const result = await client.listTools();
    const updateDraft = result.tools.find((tool) => tool.name === "update_draft");

    expect(updateDraft?.description).toMatch(/settings/i);
    expect(updateDraft?.description?.toLowerCase()).toMatch(/settings.{0,40}replaced in full/);

    await client.close();
    await server.close();
  });
});

/**
 * Important #2: the `initialize` handshake must report the package's real
 * version, not a hardcoded literal — verified over the wire from 0.1.1
 * showing a bare `"0.0.0"` (see final-review-report.md, Important #2).
 */
describe("server version", () => {
  it("reports package.json's version in serverInfo, not a hardcoded 0.0.0", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    ) as { version: string };

    const serverVersion = client.getServerVersion()?.version;
    expect(serverVersion).toBe(packageJson.version);
    expect(serverVersion).not.toBe("0.0.0");

    await client.close();
    await server.close();
  });
});

/**
 * Important #5: regression test for the exact bug that shipped broken to
 * npm once already (0.1.0, fixed in 0d68fd5). `isMainModule` must resolve
 * BOTH `import.meta.url` and `process.argv[1]` through `realpathSync`
 * before comparing — a raw string comparison (the old, broken code) never
 * matches when the entrypoint is invoked through npm's `bin` symlink,
 * because Node resolves `import.meta.url` to the real target path but
 * leaves `process.argv[1]` as the unresolved symlink path.
 *
 * This test builds a real filesystem symlink via `fs.symlinkSync` (exactly
 * npm's `node_modules/.bin/<name> -> ../pkg/dist/index.js` shape) and feeds
 * `isMainModule` the same two values Node would actually produce in that
 * scenario: `metaUrl` resolved to the real target (as `import.meta.url`
 * always is for ESM), and `argv1` as the raw, unresolved symlink path (as
 * `process.argv[1]` always is). Against the pre-fix raw-string-comparison
 * implementation (`import.meta.url === \`file://${argv1}\``), this exact
 * input would evaluate to `false` — the process would silently never
 * start. Against the current `realpathSync`-based implementation it
 * correctly evaluates to `true`.
 */
describe("isMainModule (symlink regression, Important #5)", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("identifies the real target file as the main module when invoked through a symlink", () => {
    tempDir = mkdtempSync(join(tmpdir(), "theterms-mcp-symlink-test-"));
    const targetPath = join(tempDir, "real-entrypoint.js");
    const symlinkPath = join(tempDir, "bin-symlink.js");

    writeFileSync(targetPath, "// fixture file for isMainModule symlink regression test\n");
    symlinkSync(targetPath, symlinkPath);

    // What Node actually produces in this scenario: `import.meta.url`
    // resolved to the real target, `process.argv[1]` left as the raw
    // symlink path.
    const metaUrl = pathToFileURL(targetPath).href;
    const argv1 = symlinkPath;

    expect(isMainModule(metaUrl, argv1)).toBe(true);

    // Sanity check that this is genuinely exercising symlink resolution,
    // not a trivially-true case: the old, broken raw-string comparison
    // would have failed on exactly this input.
    const oldBrokenComparison = metaUrl === `file://${argv1}`;
    expect(oldBrokenComparison).toBe(false);
  });

  it("returns false for two genuinely different files (not a symlink to each other)", () => {
    tempDir = mkdtempSync(join(tmpdir(), "theterms-mcp-symlink-test-"));
    const fileA = join(tempDir, "a.js");
    const fileB = join(tempDir, "b.js");
    writeFileSync(fileA, "// a\n");
    writeFileSync(fileB, "// b\n");

    expect(isMainModule(pathToFileURL(fileA).href, fileB)).toBe(false);
  });

  it("returns false when argv1 is undefined (module imported, not run directly)", () => {
    expect(isMainModule(import.meta.url, undefined)).toBe(false);
  });
});
