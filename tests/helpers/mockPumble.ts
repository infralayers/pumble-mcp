import { vi } from "vitest";

type RouteMap = Record<string, unknown>;

/**
 * Stub global fetch with a map of Pumble path fragment -> JSON response.
 * Unmocked paths resolve to a failure rather than a plausible-looking body, so
 * a test cannot pass against an endpoint it never meant to call.
 */
export function mockPumble(routes: RouteMap) {
  // Longest path first so /fetchScheduledMessages never shadows the singular route.
  const paths = Object.keys(routes).sort((a, b) => b.length - a.length);

  const fetchMock = vi.fn(async (url: URL | string, _init?: unknown) => {
    const urlStr = url.toString();
    const match = paths.find((path) => urlStr.includes(path));
    return match
      ? { ok: true, text: async () => JSON.stringify(routes[match]) }
      : { ok: false, text: async () => `Unmocked Pumble path: ${urlStr}` };
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

type FetchMock = ReturnType<typeof mockPumble>;

/** The request made to `path`, or throw if the code under test never called it. */
export function callTo(fetchMock: FetchMock, path: string) {
  const call = fetchMock.mock.calls.find(([url]) => url.toString().includes(path));
  if (!call) throw new Error(`Expected a request to ${path}, but none was made`);

  const init = call[1] as { method?: string; body?: string } | undefined;
  return {
    url: call[0].toString(),
    method: init?.method,
    body: init?.body ? JSON.parse(init.body) : undefined,
  };
}

/** True if the code under test never touched `path`. */
export function neverCalled(fetchMock: FetchMock, path: string) {
  return !fetchMock.mock.calls.some(([url]) => url.toString().includes(path));
}
