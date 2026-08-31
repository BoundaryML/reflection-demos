// Loads baml_src straight into the BAML runtime via the low-level
// @boundaryml/baml-bridge package (the same primitive a generated client
// wraps) and calls the one orchestration function in baml_src/main.baml.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BamlRuntime, callFunction } from "@boundaryml/baml-bridge";
import type { FormField } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const bamlSrcDir = path.join(here, "..", "..", "baml_src");

function loadBamlFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of fs.readdirSync(bamlSrcDir)) {
    if (entry.endsWith(".baml")) {
      files[entry] = fs.readFileSync(path.join(bamlSrcDir, entry), "utf-8");
    }
  }
  return files;
}

let runtime: BamlRuntime | null = null;

function getBamlRuntime(): BamlRuntime {
  if (!runtime) {
    runtime = BamlRuntime.initializeRuntime(bamlSrcDir, loadBamlFiles());
  }
  return runtime;
}

export interface ExtractionOutcome {
  fields: Record<string, string>;
  mock: boolean;
}

export async function extractForm(
  fields: FormField[],
  transcript: string,
): Promise<ExtractionOutcome> {
  const rt = getBamlRuntime();
  const saved = fields.map((f) => ({
    name: f.name,
    kind: f.kind,
    options: f.options,
    description: f.description,
  }));
  const result = await callFunction(rt, "extract_into_form", { saved, transcript });
  return { fields: result.result() as Record<string, string>, mock: false };
}
