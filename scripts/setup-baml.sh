#!/usr/bin/env bash
# One-shot reproducible setup for the BAML toolchain these demos run against.
#
#   ./scripts/setup-baml.sh                # clone BoundaryML/baml into vendor/baml
#   ./scripts/setup-baml.sh ~/src/baml     # or symlink an existing checkout
#
# Either way the checkout is moved to the commit pinned in BAML_COMMIT (detached
# HEAD; set BAML_NO_PIN=1 to skip that and build whatever HEAD is), then the two
# toolchain pieces are built FROM THAT SAME COMMIT — building them from different
# commits is the classic way to brick these demos (see README troubleshooting):
#   1. the baml-cli binary        (cargo build -p baml_cli)
#   2. the TS bridge native addon (@boundaryml/baml-bridge, napi release build)
# Finally the workspace is pnpm-installed and BAML clients are regenerated.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIN="$(head -n1 "$ROOT/BAML_COMMIT")"
VENDOR="$ROOT/vendor/baml"

if [ $# -ge 1 ]; then
  ln -sfn "$(cd "$1" && pwd)" "$VENDOR"
  echo "vendor/baml -> $(readlink "$VENDOR")"
elif [ ! -e "$VENDOR" ]; then
  echo "Cloning BoundaryML/baml into vendor/baml ..."
  git clone https://github.com/BoundaryML/baml "$VENDOR"
fi

if [ "${BAML_NO_PIN:-}" != "1" ]; then
  if [ -n "$(git -C "$VENDOR" status --porcelain)" ]; then
    echo "setup-baml: $VENDOR has uncommitted changes; refusing to move HEAD." >&2
    echo "Commit/stash them, or rerun with BAML_NO_PIN=1 to build as-is." >&2
    exit 1
  fi
  if [ "$(git -C "$VENDOR" rev-parse HEAD)" != "$PIN" ]; then
    echo "Checking out pinned commit $PIN (detached HEAD) ..."
    git -C "$VENDOR" fetch origin "$PIN" 2>/dev/null || git -C "$VENDOR" fetch origin
    git -C "$VENDOR" checkout --detach "$PIN"
  fi
fi
echo "BAML at: $(git -C "$VENDOR" log -1 --format='%H %s')"

LANG_DIR="$VENDOR/baml_language"
BRIDGE_DIR="$LANG_DIR/sdks/typescript/bridge_typescript"

echo "== Building baml-cli (cargo, debug profile) =="
(cd "$LANG_DIR" && cargo build -p baml_cli)

echo "== Building TS bridge native addon (napi, release profile) =="
# dist/ (the JS loader half) is committed in the baml repo; the napi build adds
# the platform .node binary next to it. Release profile matters: the debug addon
# is 3-4x slower, which shows in demo-5's compile pill and demo-7's cell timings.
(cd "$BRIDGE_DIR" && pnpm install && pnpm build:napi-release && pnpm build:copy-native-dts)

echo "== Installing demo workspace + regenerating BAML clients =="
(cd "$ROOT" && pnpm install && pnpm generate)

echo "Done. Run: pnpm dev  (hub at http://localhost:4400; MOCK_LLM=1 for offline)"
