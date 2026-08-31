/**
 * This demo has no generated client — the backend compiles `baml_src/` in
 * process at boot. `baml:generate` therefore just proves the package still
 * compiles and that its two entry points answer, which is what a generate step
 * would have caught anyway.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BAML_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'baml_src');

const files = Object.fromEntries(
  readdirSync(BAML_SRC)
    .filter((name) => name.endsWith('.baml'))
    .sort()
    .map((name) => [name, readFileSync(join(BAML_SRC, name), 'utf8')]),
);

let bridge;
try {
  bridge = await import('@boundaryml/baml-bridge');
} catch (error) {
  console.error('could not load @boundaryml/baml-bridge:', error.message);
  console.error('rebuild it: pnpm build:debug in baml_language/sdks/typescript/bridge_typescript');
  process.exit(1);
}

let runtime;
try {
  runtime = bridge.BamlRuntime.initializeRuntime(BAML_SRC, files);
} catch (error) {
  console.error(`baml_src/ did not compile: ${error.message}`);
  process.exit(1);
}

const session = (await bridge.callFunction(runtime, 'OpenNotebook', {})).result();
const checks = [
  ['let answer = 40 + 2', null],
  ['answer', 42],
  ['app.LoadTickets().length()', 6],
];

for (const [source, expected] of checks) {
  const value = (await bridge.callFunction(runtime, 'RunCell', { notebook: session, source })).result();
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    console.error(`FAIL  ${source}\n  expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    process.exit(1);
  }
}

console.log(
  `ok  baml_src compiles (${Object.keys(files).join(', ')}) and sessions eval — bridge ${bridge.getVersion()}`,
);
process.exit(0);
