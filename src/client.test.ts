import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    process.env.THETERMS_API_BASE_URL = "https://api.example.test/v1";

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
    process.env.THETERMS_API_BASE_URL = "http://127.0.0.1:1/v1";

    await expect(
      theTermsFetch({ method: "GET", path: "/containers" })
    ).rejects.not.toBeInstanceOf(TheTermsConfigError);
  });
});
