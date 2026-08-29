import type {
  ExtractionOutcome,
  FormField,
  ModeInfo,
  NewField,
  SeedId,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  mode: () => request<ModeInfo>("/mode"),
  listFields: () => request<FormField[]>("/fields"),
  addField: (field: NewField) =>
    request<FormField>("/fields", {
      method: "POST",
      body: JSON.stringify(field),
    }),
  deleteField: (id: number) =>
    request<void>(`/fields/${id}`, { method: "DELETE" }),
  loadPreset: (preset: SeedId) =>
    request<FormField[]>("/fields/preset", {
      method: "POST",
      body: JSON.stringify({ preset }),
    }),
  seeds: () => request<Record<SeedId, string>>("/seeds"),
  extract: (transcript: string) =>
    request<ExtractionOutcome>("/extract", {
      method: "POST",
      body: JSON.stringify({ transcript }),
    }),
};
