// Lazily loads the generated BAML client. Importing `./baml_sdk/index.js` at
// module scope runs native-addon init as a side effect (initializeRuntimeFromBytecode)
// — if the locally-built @boundaryml/baml-bridge addon is out of sync with the
// toolchain that generated baml_sdk (a real, observed failure mode while this
// checkout is under active development), that throws and would otherwise take
// the whole process down before Express even starts listening.
//
// Loading on first request instead means a stale bridge degrades this demo's
// BAML-backed routes to a clean per-request 503 — the server still boots, and
// static/health routes keep working.
type BamlSdk = typeof import("./baml_sdk/index.js");

let sdkPromise: Promise<BamlSdk> | undefined;

export function loadBamlSdk(): Promise<BamlSdk> {
  if (!sdkPromise) {
    sdkPromise = import("./baml_sdk/index.js").catch((err: unknown) => {
      sdkPromise = undefined; // allow a retry on the next request
      throw err instanceof Error ? err : new Error(String(err));
    });
  }
  return sdkPromise;
}
