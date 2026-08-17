import { describe, expect, it } from "vitest";
import { toErrorResult } from "./errors.js";

/** Builds a real `Response` (global, undici-backed) — same object shape production code sees. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function rawResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

describe("toErrorResult", () => {
  it("401 with a well-formed REST error body: isError true, surfaces the message, identifies an auth failure", async () => {
    const response = jsonResponse(401, {
      error: { code: "UNAUTHORIZED", message: "Invalid API key." },
    });

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Invalid API key." }]);
  });

  it("401 with no parseable body: isError true, falls back to a message clearly about auth", async () => {
    const response = rawResponse(401, "");

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { text: string }).text;
    expect(text.toLowerCase()).toContain("api key");
    expect(text.toLowerCase()).toMatch(/invalid|missing|revoked/);
  });

  it("429 with a well-formed REST error body: isError true, surfaces the message", async () => {
    const response = jsonResponse(429, {
      error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    });

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Too many requests. Please try again later." },
    ]);
  });

  it("429 with no parseable body: isError true, falls back to a message clearly indicating retryable", async () => {
    const response = rawResponse(429, "not json");

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text.toLowerCase()).toContain("retr"); // covers "retry" / "retryable"
  });

  it("well-formed REST error body on a 400 surfaces the REST message field", async () => {
    const response = jsonResponse(400, {
      error: { code: "VALIDATION_ERROR", message: "name is required" },
    });

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "name is required" }]);
  });

  it("well-formed REST error body on a 404 surfaces the REST message field", async () => {
    const response = jsonResponse(404, {
      error: { code: "NOT_FOUND", message: "Document not found." },
    });

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Document not found." }]);
  });

  it("malformed, non-JSON response body: isError true, no throw, message is legible and doesn't leak a parse-error stack trace", async () => {
    const body = "<html>502 Bad Gateway</html>";

    // Awaiting directly (no try/catch) is itself proof this doesn't throw —
    // a rejection here would fail the test.
    const result = await toErrorResult(rawResponse(500, body));

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    // Must not leak raw parser internals (e.g. "SyntaxError", "JSON.parse", "Unexpected token").
    expect(text).not.toMatch(/SyntaxError|JSON\.parse|Unexpected token|at JSON/i);
    expect(text.length).toBeGreaterThan(0);
  });

  it("valid JSON that doesn't match the { error: { code, message } } shape falls back to a status-based message", async () => {
    const response = jsonResponse(500, { unexpected: "shape" });

    const result = await toErrorResult(response);

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("500");
  });

  it("never throws across 401, 429, malformed, and well-formed cases", async () => {
    const cases = [
      rawResponse(401, ""),
      rawResponse(429, "not json"),
      rawResponse(500, "<html></html>"),
      jsonResponse(400, { error: { code: "X", message: "clear message" } }),
      jsonResponse(200, { ok: true }),
    ];

    for (const response of cases) {
      await expect(toErrorResult(response)).resolves.toMatchObject({ isError: true });
    }
  });
});
