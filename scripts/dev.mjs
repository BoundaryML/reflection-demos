// Flat dev orchestrator: ONE node process spawning the 15 leaf servers directly.
// Replaces the old nested pnpm->concurrently->pnpm->concurrently chain (~90 processes,
// which exhausted inotify instances on desktops with Zoom/Cursor/etc. running).
// Run via `pnpm dev` at the repo root.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bin = (pkg, name) => path.join(root, pkg, "node_modules", ".bin", name);

const procs = [
  { name: "hub", cwd: "hub", cmd: bin("hub", "vite"), args: [] },
  { name: "d1-api", cwd: "demo-1-live-enums", cmd: bin("demo-1-live-enums", "tsx"), args: ["backend/src/server.ts"] },
  { name: "d1-web", cwd: "demo-1-live-enums", cmd: bin("demo-1-live-enums", "vite"), args: ["--config", "frontend/vite.config.ts"] },
  { name: "d2-api", cwd: "demo-2-form-builder", cmd: bin("demo-2-form-builder", "tsx"), args: ["backend/src/server.ts"] },
  { name: "d2-web", cwd: "demo-2-form-builder", cmd: bin("demo-2-form-builder", "vite"), args: ["--config", "frontend/vite.config.ts"] },
  { name: "d3-api", cwd: "demo-3-tool-picker", cmd: bin("demo-3-tool-picker", "tsx"), args: ["backend/src/server.ts"] },
  { name: "d3-web", cwd: "demo-3-tool-picker", cmd: bin("demo-3-tool-picker", "vite"), args: ["--config", "frontend/vite.config.ts"] },
  { name: "d4-api", cwd: "demo-4-plugin-gate", cmd: bin("demo-4-plugin-gate", "tsx"), args: ["backend/src/index.ts"] },
  { name: "d4-web", cwd: "demo-4-plugin-gate", cmd: bin("demo-4-plugin-gate", "vite"), args: ["frontend"] },
  { name: "d5-api", cwd: "demo-5-schema-studio", cmd: bin("demo-5-schema-studio", "tsx"), args: ["backend/src/index.ts"] },
  { name: "d5-web", cwd: "demo-5-schema-studio", cmd: bin("demo-5-schema-studio", "vite"), args: ["--config", "frontend/vite.config.ts"] },
  // demo-6 is npm-managed internally; its deps live in its own subdirs, so use its local bins.
  // Its generated client embeds bytecode at generate time, so regenerate before every
  // start — otherwise an edit to functions.baml silently doesn't appear (learned on stage).
  {
    name: "d6-api",
    cwd: "demo-6-api-explorer/backend",
    cmd: "bash",
    args: ["-c", `baml generate --directory .. && exec ${path.join(root, "demo-6-api-explorer/backend/node_modules/.bin/tsx")} src/server.ts`],
  },
  { name: "d6-web", cwd: "demo-6-api-explorer/frontend", cmd: path.join(root, "demo-6-api-explorer/frontend/node_modules/.bin/vite"), args: ["--port", "4461", "--strictPort"] },
  { name: "d7-api", cwd: "demo-7-notebook", cmd: bin("demo-7-notebook", "tsx"), args: ["backend/src/server.ts"] },
  { name: "d7-web", cwd: "demo-7-notebook", cmd: bin("demo-7-notebook", "vite"), args: ["--config", "frontend/vite.config.ts"] },
];

const pad = Math.max(...procs.map((p) => p.name.length));
const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    // Negative pid = kill the child's whole process group (tsx/vite spawn grandchildren).
    try { process.kill(-c.pid, "SIGTERM"); } catch { try { c.kill("SIGTERM"); } catch {} }
  }
  // NOT unref'd: keep the process alive until the SIGKILL sweep has run,
  // otherwise the loop can drain first and tsx grandchildren survive.
  setTimeout(() => {
    for (const c of children) {
      try { process.kill(-c.pid, "SIGKILL"); } catch {}
      try { c.kill("SIGKILL"); } catch {}
    }
    process.exit(code);
  }, 1500);
}

for (const p of procs) {
  const child = spawn(p.cmd, p.args, {
    cwd: path.join(root, p.cwd),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group, so shutdown() can kill the whole subtree
  });
  children.push(child);
  const tag = `[${p.name.padEnd(pad)}]`;
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const l of lines) console.log(`${tag} ${l}`);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code, sig) => {
    console.log(`${tag} exited (${sig ?? code})`);
    // A crashed backend should be visible but not tear the whole board down;
    // Ctrl-C (SIGINT) is the way to stop everything.
    if (!shuttingDown && code !== 0 && sig === null) {
      console.log(`${tag} NOTE: crashed — other demos keep running; restart with Ctrl-C + pnpm dev`);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
console.log(`reflection-demos: ${procs.length} servers starting… hub at http://localhost:4400 (Ctrl-C stops all)`);
