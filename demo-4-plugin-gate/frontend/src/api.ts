export interface ContractField {
  name: string;
  type: string;
}

export interface Example {
  id: string;
  label: string;
  vendor: string;
  blurb: string;
  name: string;
  source: string;
  bindings: Record<string, string>;
}

export interface SampleDocument {
  id: string;
  title: string;
  body: string;
}

export interface PluginField {
  name: string;
  type: string;
  contract: boolean;
}

export interface Plugin {
  name: string;
  vendor: string;
  source: string;
  bindings: Record<string, string>;
  manifest: string;
  fields: PluginField[];
  installedAt: string;
}

export interface Diagnostic {
  code: string;
  message: string;
  file: string | null;
  start: number | null;
  end: number | null;
}

export interface Failure {
  message: string;
  diagnostics: Diagnostic[];
}

export interface Report {
  summary: string;
  key_points: string[];
  extras: Record<string, string>;
  prompt: string;
}

export interface Bootstrap {
  mode: "mock" | "live";
  model: string;
  host: { status: "starting" | "ready" | "failed"; error: string | null };
  contract: ContractField[];
  examples: Example[];
  documents: SampleDocument[];
  plugins: Plugin[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  return (await response.json()) as T;
}

export const api = {
  bootstrap: () => call<Bootstrap>("/api/bootstrap"),

  install: (source: string, bindings: Record<string, string>, vendor: string) =>
    call<{ ok: true; plugin: Plugin } | { ok: false; error: Failure }>("/api/plugins", {
      method: "POST",
      body: JSON.stringify({ source, bindings, vendor }),
    }),

  uninstall: (name: string) =>
    call<{ ok: true; plugins: Plugin[] }>(`/api/plugins/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  run: (name: string, documentId: string) =>
    call<{ ok: true; report: Report; mode: string } | { ok: false; error: Failure }>(
      `/api/plugins/${encodeURIComponent(name)}/run`,
      { method: "POST", body: JSON.stringify({ documentId }) },
    ),

  force: (source: string, bindings: Record<string, string>, documentId: string) =>
    call<{ ok: true; report: Report } | { ok: false; error: Failure }>("/api/force", {
      method: "POST",
      body: JSON.stringify({ source, bindings, documentId }),
    }),
};

/** The field names a submitted plugin declares, for the binding pickers. */
export function declaredFields(source: string): string[] {
  const body = /\{([\s\S]*)\}/.exec(source)?.[1] ?? "";
  const names: string[] = [];
  for (const line of body.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z_]/.exec(line);
    if (match) names.push(match[1]!);
  }
  return names;
}

export function className(source: string): string {
  return /(?:^|\n)\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(source)?.[1] ?? "";
}
