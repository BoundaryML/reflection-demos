export interface Diagnostic {
  code: string;
  message: string;
  file: string | null;
}

export type CellOutcome =
  | { status: 'ok'; value: unknown }
  | { status: 'compile-error'; message: string; diagnostics: Diagnostic[] }
  | { status: 'runtime-error'; message: string; trace: string[] }
  | { status: 'busy'; message: string };

export interface RunResult {
  outcome: CellOutcome;
  elapsedMs: number;
  live: number;
}

export interface NotebookInfo {
  id: string;
  openedAt: number;
  cellsRun: number;
}

export interface SeedCell {
  kind: 'note' | 'baml';
  source: string;
}

export interface Cell {
  id: string;
  kind: 'note' | 'baml';
  source: string;
  state: 'idle' | 'running';
  /** Monotonic execution number, Jupyter-style. */
  runIndex: number | null;
  result: RunResult | null;
}
