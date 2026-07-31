type FetchLike = typeof fetch;

export async function fetchGoogleJson<T>(input: {
  url: string;
  accessToken: string;
  body: Record<string, unknown>;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000);
  try {
    const response = await (input.fetchFn ?? fetch)(input.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Google reporting request failed with status ${response.status}.`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function finiteNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function boundedText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
