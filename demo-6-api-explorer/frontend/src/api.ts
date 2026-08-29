import type { FunctionsResponse, InvokeResult } from "./types";

export async function fetchFunctions(): Promise<FunctionsResponse> {
  const res = await fetch("/api/functions");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `GET /api/functions failed (${res.status})`);
  }
  return res.json();
}

export async function invoke(name: string, args: Record<string, string>): Promise<InvokeResult> {
  const res = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  return res.json();
}
