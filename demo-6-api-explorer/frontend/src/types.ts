// Mirrors baml_src/reflection.baml's ParamInfo / FunctionInfo / InvokeResult.
// Kept as plain interfaces (not generated) so the frontend never needs the
// native BAML bridge — it only ever talks to the backend's two JSON routes.

export interface ParamInfo {
  name: string;
  type_name: string;
  /** JSON Schema for this parameter's type, as a JSON string. */
  json_schema: string;
  required: boolean;
}

export interface FunctionInfo {
  name: string;
  docstring: string | null;
  params: ParamInfo[];
  returns_type_name: string;
  returns_json_schema: string;
  /** "never" if the function cannot throw. */
  throws_type_name: string;
}

export interface FunctionsResponse {
  functions: FunctionInfo[];
  mock: boolean;
}

export interface InvokeResult {
  ok: boolean;
  value: unknown;
  error_type: string | null;
  error_message: string | null;
}
