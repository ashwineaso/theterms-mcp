import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TheTermsConfigError, theTermsFetch } from "./client.js";

const ORIGINAL_ENV = { ...process.env };

describe("theTermsFetch config validation", () => {
  beforeEach(() => {
    delete process.env.THETERMS_API_KEY;
    delete process.env.THETERMS_API_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws a clear TheTermsConfigError when THETERMS_API_KEY is missing", async () => {
    process.env.THETERMS_API_BASE_URL = "https://api.example.test/api/v1";

    await expect(theTermsFetch({ method: "GET", path: "/containers" })).rejects.toThrow(
      TheTermsConfigError
    );
    await expect(theTermsFetch({ method: "GET", path: "/containers" })).rejects.toThrow(
      /THETERMS_API_KEY/
    );
  });

  it("throws a clear TheTermsConfigError when THETERMS_API_BASE_URL is missing", async () => {
    process.env.THETERMS_API_KEY = "test-key";

    await expect(theTermsFetch({ method: "GET", path: "/containers" })).rejects.toThrow(
      TheTermsConfigError
    );
    await expect(theTermsFetch({ method: "GET", path: "/containers" })).rejects.toThrow(
      /THETERMS_API_BASE_URL/
    );
  });

  it("reads env vars at call time, not module load time — setting them right before the call works", async () => {
    process.env.THETERMS_API_KEY = "test-key";
    // Loopback on a closed port: fails fast with ECONNREFUSED, no DNS
    // dependency (safe under sandboxed/offline CI). We only care that
    // config validation passes and a real request is attempted — a
    // network-level rejection (not TheTermsConfigError) is proof of that.
    process.env.THETERMS_API_BASE_URL = "http://127.0.0.1:1/api/v1";

    await expect(
      theTermsFetch({ method: "GET", path: "/containers" })
    ).rejects.not.toBeInstanceOf(TheTermsConfigError);
  });
});

/**
 * Enforces the `THETERMS_API_BASE_URL` convention this package relies on:
 * the env var is the API origin INCLUDING the `/api/v1` mount prefix (per
 * `theterms`'s `server/api/v1/index.ts:29`, `new Hono().basePath("/api/v1")`),
 * and every tool's own path string (e.g. `/containers`) is bare/relative —
 * it does not itself repeat `/api/v1`. This asserts the fully resolved URL
 * `theTermsFetch` actually hands to the network, not just the config
 * (method/path) passed into it — the gap the mocked-`callTheTermsApi` tool
 * tests in `src/tools/*.test.ts` cannot see, since they never reach this
 * boundary.
 */
describe("theTermsFetch URL construction (THETERMS_API_BASE_URL convention)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.THETERMS_API_KEY = "test-key";
    process.env.THETERMS_API_BASE_URL = "https://api.example.test/api/v1";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves a base URL ending in /api/v1 plus a tool's bare resource path into the correct full URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await theTermsFetch({ method: "GET", path: "/containers" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl).toBeInstanceOf(URL);
    expect(calledUrl.toString()).toBe("https://api.example.test/api/v1/containers");
  });

  it("resolves a nested tool path (e.g. update_draft's /documents/:id/draft) correctly against the same base URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await theTermsFetch({ method: "PUT", path: "/documents/abc-123/draft", body: { ok: true } });

    const [calledUrl] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.toString()).toBe("https://api.example.test/api/v1/documents/abc-123/draft");
  });
});
