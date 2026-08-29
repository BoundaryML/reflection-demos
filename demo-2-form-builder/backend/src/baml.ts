// Loads baml_src straight into the BAML runtime via the low-level
// @boundaryml/baml-bridge package (the same primitive the generated
// `baml_client` normally wraps) and calls the two orchestration functions
// defined in baml_src/main.baml: ExtractIntoFormLive and ExtractIntoFormMock.
//
// We talk to the bridge directly rather than through generated client code
// because client generation needs the locally-built baml-cli binary, which
// may not be built yet in this checkout (see README). The bridge package
// itself is prebuilt and needs no compilation step, so this path always
// works.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BamlRuntime, callFunction } from "@boundaryml/baml-bridge";
import type { FormField } from "./db.js";
import { MOCK_EXTRACTIONS, guessSeed } from "./seeds.js";

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

/** Re-parse baml_src from disk and rebuild the runtime (used after edits during dev). */
export function reloadBaml(): void {
  runtime = BamlRuntime.initializeRuntime(bamlSrcDir, loadBamlFiles());
}

function toSavedField(field: FormField) {
  return {
    name: field.name,
    kind: field.kind,
    options: field.options,
    description: field.description,
  };
}

function fallbackForKind(field: FormField): unknown {
  switch (field.kind) {
    case "number":
      return 0;
    case "dropdown":
      return field.options[0] ?? "";
    case "bulleted_list":
      return [];
    case "text":
    default:
      return "(not mentioned in the text)";
  }
}

/** Build the canned "model output" JSON for the given fields, backed by the closest seed dataset. */
function buildMockJson(fields: FormField[], transcript: string): string {
  const seedId = guessSeed(transcript);
  const canned = MOCK_EXTRACTIONS[seedId];
  const value: Record<string, unknown> = {};
  for (const field of fields) {
    value[field.name] = field.name in canned ? canned[field.name] : fallbackForKind(field);
  }
  return JSON.stringify(value);
}

export interface ExtractionOutcome {
  fields: Record<string, string>;
  mock: boolean;
}

export async function extractForm(
  fields: FormField[],
  transcript: string,
  mock: boolean,
): Promise<ExtractionOutcome> {
  const rt = getBamlRuntime();
  const saved = fields.map(toSavedField);

  if (mock) {
    const mockJson = buildMockJson(fields, transcript);
    const result = await callFunction(rt, "ExtractIntoFormMock", {
      saved,
      transcript,
      mock_json: mockJson,
    });
    return { fields: result.result() as Record<string, string>, mock: true };
  }

  const result = await callFunction(rt, "ExtractIntoFormLive", {
    saved,
    transcript,
  });
  return { fields: result.result() as Record<string, string>, mock: false };
}
