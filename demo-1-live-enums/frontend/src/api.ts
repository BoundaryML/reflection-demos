import type { Category, Config, Ticket } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getConfig: () => request<Config>("/config"),

  getCategories: () => request<Category[]>("/categories"),
  addCategory: (name: string, description: string | null) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  updateCategory: (id: number, fields: { name?: string; description?: string | null }) =>
    request<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: "DELETE" }),

  getTickets: () => request<Ticket[]>("/tickets"),
  addTicket: (customer: string, subject: string, body: string) =>
    request<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify({ customer, subject, body }),
    }),
  resetDemo: () =>
    request<{ categories: Category[]; tickets: Ticket[] }>("/reset", { method: "POST" }),
  classifyTicket: (id: number) =>
    request<{ ticket: Ticket; mode: string }>(`/tickets/${id}/classify`, { method: "POST" }),
  classifyAll: () =>
    request<{ tickets: Ticket[]; mode: string; failed: Array<{ id: number; error: string }> }>(
      "/tickets/classify-all",
      { method: "POST" },
    ),
};
