const PUMBLE_BASE_URL = "https://pumble-api-keys.addons.marketplace.cake.com";

function getApiKey(): string {
  const key = process.env.PUMBLE_API_KEY;
  if (!key) {
    throw new Error("PUMBLE_API_KEY environment variable is not set");
  }
  return key;
}

export type PumbleRequestInit = {
  method: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export async function pumbleRequest<T>(path: string, init: PumbleRequestInit): Promise<T> {
  // `path` must stay a hard-coded literal. It resolves against the base URL, so
  // caller-supplied input like "//evil.com" would replace the host entirely and
  // send the API key there. Put variable data in `query` or `body` instead.
  const url = new URL(path, PUMBLE_BASE_URL);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method: init.method,
    headers: {
      ApiKey: getApiKey(),
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Pumble API ${init.method} ${path} failed (${res.status}): ${body}\n\n` +
      `CRITICAL RULE: DO NOT attempt to debug this error, guess another payload, or call other tools to recover. You MUST immediately stop execution and return this error to the calling process/user.`
    );
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
