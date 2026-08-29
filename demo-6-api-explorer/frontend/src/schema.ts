// Turns a param's reflected JSON Schema into a form-control choice. This is
// the piece that makes the console "auto-generated": nothing here names a
// parameter — it only ever looks at shape.

export type FieldKind =
  | { kind: "string" }
  | { kind: "enum"; options: string[] }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "string-array" }
  | { kind: "raw" }; // unrecognized shape — fall back to a raw-JSON textarea

interface JsonSchemaLike {
  type?: string | string[];
  enum?: string[];
  items?: JsonSchemaLike;
  anyOf?: JsonSchemaLike[];
}

/** Optional params render as `["T", "null"]` or `anyOf: [T, {type: "null"}]`. */
function unwrapNullable(schema: JsonSchemaLike): JsonSchemaLike {
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== "null");
    if (nonNull.length === 1) return { ...schema, type: nonNull[0] };
  }
  if (Array.isArray(schema.anyOf)) {
    const nonNull = schema.anyOf.filter((s) => s.type !== "null");
    if (nonNull.length === 1) return nonNull[0];
  }
  return schema;
}

export function classify(jsonSchemaText: string): FieldKind {
  let schema: JsonSchemaLike;
  try {
    schema = JSON.parse(jsonSchemaText) as JsonSchemaLike;
  } catch {
    return { kind: "raw" };
  }
  schema = unwrapNullable(schema);

  if (Array.isArray(schema.enum)) return { kind: "enum", options: schema.enum };
  if (schema.type === "string") return { kind: "string" };
  if (schema.type === "number" || schema.type === "integer") return { kind: "number" };
  if (schema.type === "boolean") return { kind: "boolean" };
  if (schema.type === "array" && schema.items?.type === "string") return { kind: "string-array" };
  return { kind: "raw" };
}
