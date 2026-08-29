# vendor/

`vendor/baml` (gitignored) is where this repo finds the BAML toolchain checkout —
either a symlink to an existing clone of [BoundaryML/baml](https://github.com/BoundaryML/baml)
or a clone created by `scripts/setup-baml.sh`.

The exact commit these demos are built and verified against is pinned in the
repo-root `BAML_COMMIT` file. Run:

```bash
./scripts/setup-baml.sh                # clones into vendor/baml at the pinned commit
./scripts/setup-baml.sh ~/src/baml     # or: symlink an existing checkout, pin it
```

Everything in the repo that touches the toolchain goes through this directory:
the `@boundaryml/baml-bridge` `link:`/`file:` dependencies, the `scripts/baml-dev`
CLI wrapper, and demo-4's plugin host.
