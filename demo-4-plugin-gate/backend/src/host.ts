/**
 * A long-lived BAML plugin host.
 *
 * `baml_src/host.baml` runs as one child process for the life of the server and
 * speaks newline-delimited JSON on stdin/stdout. Keeping it alive is what lets
 * the registry hold minted runtime types across requests — and it keeps the
 * ~2s BAML startup off the request path.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface PluginField {
  name: string;
  type: string;
  contract: boolean;
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

export interface Reply {
  id: string;
  ok: boolean;
  manifest: string | null;
  fields: PluginField[] | null;
  report: Report | null;
  error: Failure | null;
}

export type Request =
  | { op: "install"; name: string; source: string; bindings: Record<string, string> }
  | { op: "invoke"; name: string; document: string; canned?: string }
  | {
      op: "force";
      name: string;
      source: string;
      bindings: Record<string, string>;
      document: string;
      canned?: string;
    };

/** Where the locally built BAML toolchain lives. */
function resolveCli(): string {
  // Repo root is three levels up from this file (demo-4-plugin-gate/backend/src/host.ts).
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
  const candidates = [
    process.env.BAML_CLI,
    path.join(repoRoot, "vendor/baml/baml_language/target/debug/baml-cli"),
    path.join(homedir(), ".baml/bin/baml-dev"),
  ].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "no BAML CLI found. Build it with `cargo build -p baml_cli` in baml_language, " +
      "or point BAML_CLI at a binary.",
  );
}

export type HostStatus = "starting" | "ready" | "failed";

export class PluginHost {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private readonly pending = new Map<string, (reply: Reply) => void>();
  private counter = 0;
  private booting: Promise<void> | null = null;

  status: HostStatus = "starting";
  lastError: string | null = null;

  /** Start (or restart) the child and resolve once it answers a ping. */
  async start(): Promise<void> {
    if (this.booting) return this.booting;
    this.booting = this.boot();
    return this.booting;
  }

  private async boot(): Promise<void> {
    this.status = "starting";
    const cli = resolveCli();
    const child = spawn(cli, ["run", "plugin_host"], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    this.child = child;
    // `tsx watch` replaces this process on every edit; make sure the BAML child
    // never outlives it.
    process.once("exit", () => child.kill("SIGKILL"));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      const text = chunk.trim();
      // The dev toolchain chatters on stderr; only surface real trouble.
      if (text && !/^warning:/m.test(text)) process.stderr.write(`[baml] ${text}\n`);
    });

    child.on("exit", (code) => {
      this.status = "failed";
      this.lastError = `the BAML plugin host exited with code ${code ?? "?"}`;
      for (const resolve of this.pending.values()) {
        resolve({
          id: "",
          ok: false,
          manifest: null,
          fields: null,
          report: null,
          error: { message: this.lastError, diagnostics: [] },
        });
      }
      this.pending.clear();
      this.booting = null;
    });

    this.lines = createInterface({ input: child.stdout });
    this.lines.on("line", (line) => {
      let reply: Reply;
      try {
        reply = JSON.parse(line) as Reply;
      } catch {
        return; // the host's own trailing `null` return value, or toolchain noise
      }
      if (!reply || typeof reply.id !== "string") return;
      const resolve = this.pending.get(reply.id);
      if (resolve) {
        this.pending.delete(reply.id);
        resolve(reply);
      }
    });

    // The first request pays for BAML's startup compile; get it over with now.
    const probe = await this.send({
      op: "install",
      name: "__probe__",
      source: "class __probe__ {\n  summary string\n  key_points string[]\n}",
      bindings: { summary: "summary", key_points: "key_points" },
    });
    if (!probe.ok) {
      this.status = "failed";
      this.lastError = probe.error?.message ?? "the BAML plugin host failed to start";
      throw new Error(this.lastError);
    }
    this.status = "ready";
    this.lastError = null;
  }

  send(request: Request): Promise<Reply> {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      return Promise.resolve({
        id: "",
        ok: false,
        manifest: null,
        fields: null,
        report: null,
        error: {
          message: this.lastError ?? "the BAML plugin host is not running",
          diagnostics: [],
        },
      });
    }
    const id = String(++this.counter);
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify({ id, ...request })}\n`);
    });
  }

  stop(): void {
    this.child?.stdin.end();
    this.child?.kill();
  }
}
