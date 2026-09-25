import { describe, expect, it } from "vitest";
import {
  exceedsMaxBodySize,
  extractClientIp,
  isBodyReadFailure,
  isCrossOriginRequest,
  MAX_BODY_BYTES,
  readBodyWithinLimit,
  type HeaderReader,
} from "./request-guard";

function headers(values: Record<string, string>): HeaderReader {
  return { get: (name) => values[name] ?? null };
}

describe("extractClientIp", () => {
  it("uses the first entry of x-forwarded-for", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" }))).toBe(
      "203.0.113.5",
    );
  });

  it("trims whitespace around the first entry", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "  203.0.113.5  , 70.41.3.18" }))).toBe("203.0.113.5");
  });

  it("accepts an IPv6 address", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "::1" }))).toBe("::1");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(extractClientIp(headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "203.0.113.5", "x-real-ip": "198.51.100.7" }))).toBe(
      "203.0.113.5",
    );
  });

  it("falls back to loopback when neither header is present", () => {
    expect(extractClientIp(headers({}))).toBe("127.0.0.1");
  });

  it("falls back to loopback when x-forwarded-for is blank", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "   " }))).toBe("127.0.0.1");
  });

  it("falls back to loopback when x-forwarded-for is not a valid IP", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "not-an-ip" }))).toBe("127.0.0.1");
  });

  it("falls back to loopback when x-real-ip is not a valid IP, ignoring it", () => {
    expect(extractClientIp(headers({ "x-real-ip": "<script>" }))).toBe("127.0.0.1");
  });

  it("falls through to x-real-ip when x-forwarded-for is present but not a valid IP", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "not-an-ip", "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });
});

describe("exceedsMaxBodySize", () => {
  it("allows exactly the limit", () => {
    expect(exceedsMaxBodySize(MAX_BODY_BYTES)).toBe(false);
  });

  it("rejects one byte over the limit", () => {
    expect(exceedsMaxBodySize(MAX_BODY_BYTES + 1)).toBe(true);
  });
});

function jsonRequest(body: string, headerOverrides: Record<string, string> = {}): Request {
  return new Request("http://example.com/api/whatever", {
    method: "POST",
    headers: { "content-type": "application/json", host: "example.com", ...headerOverrides },
    body,
  });
}

describe("readBodyWithinLimit", () => {
  it("reads a small body in full", async () => {
    const result = await readBodyWithinLimit(jsonRequest('{"a":1}'));
    expect(result).toBe('{"a":1}');
  });

  it("returns a failure sentinel for a body over the cap, without buffering it fully", async () => {
    const oversized = "x".repeat(MAX_BODY_BYTES + 1);
    const result = await readBodyWithinLimit(jsonRequest(oversized));
    expect(isBodyReadFailure(result)).toBe(true);
  });

  it("returns a failure sentinel when the body stream errors mid-read", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"name":"Asha"'));
        controller.error(new Error("connection reset"));
      },
    });
    const request = new Request("http://example.com/api/whatever", {
      method: "POST",
      headers: { "content-type": "application/json", host: "example.com" },
      body: stream,
      // @ts-expect-error Node's fetch implementation requires `duplex` for a streaming request body; it isn't in
      // the DOM lib's RequestInit type yet.
      duplex: "half",
    });
    const result = await readBodyWithinLimit(request);
    expect(isBodyReadFailure(result)).toBe(true);
  });

  it("returns an empty string for a bodyless request", async () => {
    const request = new Request("http://example.com/api/whatever", { method: "GET" });
    const result = await readBodyWithinLimit(request);
    expect(result).toBe("");
  });
});

describe("isCrossOriginRequest", () => {
  it("returns false when Origin is absent", () => {
    expect(isCrossOriginRequest(jsonRequest("{}"))).toBe(false);
  });

  it("returns false when Origin's host matches Host", () => {
    expect(isCrossOriginRequest(jsonRequest("{}", { origin: "https://example.com" }))).toBe(false);
  });

  it("returns true when Origin's host does not match Host", () => {
    expect(isCrossOriginRequest(jsonRequest("{}", { origin: "https://evil.example" }))).toBe(true);
  });

  it("returns true when Origin is not a valid URL", () => {
    expect(isCrossOriginRequest(jsonRequest("{}", { origin: "not a url" }))).toBe(true);
  });

  it("compares Origin against x-forwarded-host, not Host, when both are present", () => {
    const request = new Request("http://example.com/api/whatever", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "internal.local",
        "x-forwarded-host": "example.com",
        origin: "https://example.com",
      },
      body: "{}",
    });
    expect(isCrossOriginRequest(request)).toBe(false);
  });
});
