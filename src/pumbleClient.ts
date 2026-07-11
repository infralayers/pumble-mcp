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
    throw new Error(`Pumble API ${init.method} ${path} failed (${res.status}): ${body}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
