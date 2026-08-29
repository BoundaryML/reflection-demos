export type ToolId = "calculator" | "unit_converter" | "note_saver" | "weather";

export interface ToolMeta {
  id: ToolId;
  label: string;
  icon: string;
  description: string;
  className: string;
  example: string;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  created_at: string;
  summary: string;
}

export type ChatStatus = "matched" | "no_tools" | "no_match" | "error";

export interface ChatResponse {
  status: ChatStatus;
  reply: string;
  tool?: ToolId;
  toolLabel?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  promptPreview?: string;
}

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `request to ${input} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchTools(): Promise<ToolMeta[]> {
  return jsonFetch<ToolMeta[]>("/api/tools");
}

export function fetchMode(): Promise<{ mock: boolean }> {
  return jsonFetch<{ mock: boolean }>("/api/mode");
}

export function fetchNotes(): Promise<Note[]> {
  return jsonFetch<Note[]>("/api/notes");
}

export function sendChat(message: string, enabled: ToolId[]): Promise<ChatResponse> {
  return jsonFetch<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, enabled }),
  });
}
