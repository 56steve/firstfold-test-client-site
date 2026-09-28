import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES } from "@/lib/request-guard";
import { POST } from "./route";

const VALID_FIELDS = {
  name: "Asha Rao",
  phone: "+91 90000 00000",
  date: "2026-10-01",
  start: "09:00",
};

function otpRequest(options: {
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

  return new Request("http://example.com/api/book/otp", {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify(VALID_FIELDS),
  });
}

function requestWithErroringBody(): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"name":"Asha"'));
      controller.error(new Error("connection reset"));
    },
  });

  const headers = new Headers({ "content-type": "application/json", host: "example.com" });
  return new Request("http://example.com/api/book/otp", {
    method: "POST",
    headers,
    body: stream,
    // @ts-expect-error Node's fetch implementation requires `duplex` for a streaming request body; it isn't in
    // the DOM lib's RequestInit type yet.
    duplex: "half",
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

describe("POST /api/book/otp", () => {
  it("relays an otp_sent response from the platform", async () => {
    const body = { status: "otp_sent", otpId: "otp-1", expiresInSeconds: 600, phoneHint: "•••• 0000" };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("fetch was not called");
    const [url, init] = call;
    expect(url).toBe("https://platform.example/api/site/bookings/otp");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const forwarded = JSON.parse(init.body as string) as { fields: unknown; clientIp: string };
    expect(forwarded.fields).toMatchObject({ name: "Asha Rao", phone: "+91 90000 00000", date: "2026-10-01", start: "09:00" });
    expect(forwarded.clientIp).toBe("127.0.0.1");
  });

  it("rejects a body over the 16 KB cap without forwarding it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const oversizedName = "x".repeat(MAX_BODY_BYTES + 1);
    const response = await POST(otpRequest({ body: JSON.stringify({ ...VALID_FIELDS, name: oversizedName }) }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't valid JSON", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({ body: "not json" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a request whose Content-Type is not application/json", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({ contentType: "text/plain" }));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request (Origin host does not match Host)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({ origin: "https://evil.example", host: "example.com" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a same-origin request (Origin host matches Host)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "otp_sent", otpId: "x", expiresInSeconds: 1, phoneHint: "y" }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({ origin: "https://example.com", host: "example.com" }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("compares Origin against x-forwarded-host, not Host, when both are present (behind a proxy)", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "otp_sent", otpId: "x", expiresInSeconds: 1, phoneHint: "y" }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      otpRequest({ origin: "https://example.com", host: "internal.local", forwardedHost: "example.com" }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a request whose Origin matches Host but not x-forwarded-host", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      otpRequest({ origin: "https://internal.local", host: "internal.local", forwardedHost: "example.com" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the 400 contract error, not a 500, when the body stream errors mid-read", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(requestWithErroringBody());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      code: "invalid",
      message: "We couldn't read that request. Please try again.",
      field: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 without calling the platform when the token is not configured", async () => {
    delete process.env.FIRSTFOLD_SITE_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 on a network error reaching the platform", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("returns a generic 502 when the platform's response is not JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("returns a generic 502 when the platform answers with an unrecognized status", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "otp_sent", otpId: "x", expiresInSeconds: 1, phoneHint: "y" }), {
          status: 418,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("rejects a request with invalid field types without calling the platform", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({ body: JSON.stringify({ ...VALID_FIELDS, name: 42 }) }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays a 409 taken error", async () => {
    const body = { status: "error", code: "taken", message: "Someone just booked that slot.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("relays a 422 invalid error with a field", async () => {
    const body = { status: "error", code: "invalid", message: "That phone number doesn't look right.", field: "phone" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("relays a 400 invalid error", async () => {
    const body = { status: "error", code: "invalid", message: "We couldn't read that request.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns a generic 502 when the upstream request times out", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(otpRequest({}));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("passes an AbortSignal to the upstream fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify({ status: "otp_sent", otpId: "x", expiresInSeconds: 1, phoneHint: "y" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await POST(otpRequest({}));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
