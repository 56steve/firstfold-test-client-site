import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES } from "@/lib/request-guard";
import { POST } from "./route";

const VALID_FIELDS = { otpId: "0198f2b0-1234-7abc-8def-0123456789ab", code: "123456" };

function confirmRequest(options: {
  readonly body?: string;
  readonly contentType?: string | null;
  readonly origin?: string;
  readonly host?: string;
  readonly forwardedHost?: string;
}): Request {
  const headers = new Headers();
  if (options.contentType !== null) headers.set("content-type", options.contentType ?? "application/json");
  headers.set("host", options.host ?? "example.com");
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.forwardedHost !== undefined) headers.set("x-forwarded-host", options.forwardedHost);

  return new Request("http://example.com/api/book/confirm", {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify(VALID_FIELDS),
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FIRSTFOLD_SITE_TOKEN = "test-token";
  process.env.FIRSTFOLD_API_ORIGIN = "https://platform.example";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/book/confirm", () => {
  it("relays a booked response from the platform", async () => {
    const body = { status: "booked", date: "2026-10-01", start: "09:00", end: "09:30" };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("fetch was not called");
    const [url, init] = call;
    expect(url).toBe("https://platform.example/api/site/bookings/confirm");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const forwarded = JSON.parse(init.body as string) as { otpId: string; code: string; clientIp: string };
    expect(forwarded).toEqual({ otpId: VALID_FIELDS.otpId, code: VALID_FIELDS.code, clientIp: "127.0.0.1" });
  });

  it("rejects a body over the 16 KB cap without forwarding it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      confirmRequest({ body: JSON.stringify({ ...VALID_FIELDS, junk: "x".repeat(MAX_BODY_BYTES + 1) }) }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't valid JSON", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({ body: "not json" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a request whose Content-Type is not application/json", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({ contentType: "text/plain" }));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request (Origin host does not match Host)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({ origin: "https://evil.example", host: "example.com" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("compares Origin against x-forwarded-host, not Host, when both are present (behind a proxy)", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status: "booked", date: "2026-10-01", start: "09:00", end: "09:30" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      confirmRequest({ origin: "https://example.com", host: "internal.local", forwardedHost: "example.com" }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a request with an invalid otpId without calling the platform", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({ body: JSON.stringify({ ...VALID_FIELDS, otpId: "not-a-uuid" }) }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a request with a malformed code without calling the platform", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({ body: JSON.stringify({ ...VALID_FIELDS, code: "12ab" }) }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 without calling the platform when the token is not configured", async () => {
    delete process.env.FIRSTFOLD_SITE_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 on a network error reaching the platform", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("relays a 422 wrong_code error", async () => {
    const body = { status: "error", code: "wrong_code", message: "That code isn't right. 4 tries left.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("relays a 410 expired error", async () => {
    const body = { status: "error", code: "expired", message: "That code has expired.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 410 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("relays a 429 too_many_attempts error", async () => {
    const body = { status: "error", code: "too_many_attempts", message: "Too many tries.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("relays a 409 taken error", async () => {
    const body = { status: "error", code: "taken", message: "Someone just booked that slot.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns a generic 502 when the platform answers with an unrecognized status", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status: "booked", date: "2026-10-01", start: "09:00", end: "09:30" }), { status: 418 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("relays a 400 invalid error", async () => {
    const body = { status: "error", code: "invalid", message: "We couldn't read that request.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns a generic 502 when the upstream request times out", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(confirmRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("passes an AbortSignal to the upstream fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify({ status: "booked", date: "2026-10-01", start: "09:00", end: "09:30" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await POST(confirmRequest({}));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
