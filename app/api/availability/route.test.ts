import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const VALID_AVAILABILITY = {
  weekStart: "2026-09-28",
  today: "2026-09-25",
  slotMinutes: 30,
  previousWeek: "2026-09-21",
  nextWeek: "2026-10-05",
  days: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map(
    (date) => ({ date, closed: false, closedNote: null, slots: [] }),
  ),
};

function availabilityRequest(query = ""): Request {
  return new Request(`http://example.com/api/availability${query}`);
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

describe("GET /api/availability", () => {
  it("forwards to the platform and relays a 200 availability response", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify(VALID_AVAILABILITY), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest("?week=2026-09-28"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(VALID_AVAILABILITY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("fetch was not called");
    const [url, init] = call;
    expect(url).toBe("https://platform.example/api/site/availability?week=2026-09-28");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("forwards without a query when week is absent", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify(VALID_AVAILABILITY), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await GET(availabilityRequest());

    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("fetch was not called");
    expect(call[0]).toBe("https://platform.example/api/site/availability");
  });

  it("rejects a malformed week without calling the platform", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest("?week=not-a-date"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays a 403 unavailable error", async () => {
    const body = { status: "error", code: "unavailable", message: "Not taking bookings.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("relays a 409 paused error", async () => {
    const body = { status: "error", code: "paused", message: "Paused for the day.", field: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns a generic 502 without calling the platform when the token is not configured", async () => {
    delete process.env.FIRSTFOLD_SITE_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 on a network error reaching the platform", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("returns a generic 502 when the upstream request times out", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("passes an AbortSignal to the upstream fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify(VALID_AVAILABILITY), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await GET(availabilityRequest());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 502 when the platform's response is not JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("returns a generic 502 when the platform answers with an unrecognized status", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(VALID_AVAILABILITY), { status: 418 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error", code: "failed" });
  });

  it("sets Cache-Control: no-store on its own response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(VALID_AVAILABILITY), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(availabilityRequest());

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
