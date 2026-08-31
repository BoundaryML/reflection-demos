// ============================================================================
// The whole demo, in one file. Two entry points, both generic — nothing here
// names a function from functions.baml:
//
//   ListFunctions()              — BEP-066 Scenario 6: reflect.Package.current()
//                                   enumerates every function in this package
//                                   and reflect.signature() describes each one.
//   InvokeFunction(name, args)   — reflect.call_any() invokes any of them by
//                                   name, with arguments checked at runtime.
//
// The backend exposes exactly these two as HTTP endpoints. The frontend
// builds the whole console — cards, forms, results — from what they return.
// ============================================================================

/// One parameter of a reflected function, shaped for an auto-generated form.
class ParamInfo {
  name string
  type_name string
  /// JSON Schema for this parameter's type (`baml.json.schema`), as a JSON
  /// string — the frontend picks a form control from its `"type"`.
  json_schema string
  required bool
}

/// One function of this package, shaped for an auto-generated console card.
class FunctionInfo {
  name string
  docstring string?
  params ParamInfo[]
  returns_type_name string
  returns_json_schema string
  /// "never" if the function cannot throw.
  throws_type_name string
}

function _param_info(name: string, t: reflect.Type, required: bool) -> ParamInfo throws never {
  let schema = baml.json.stringify(baml.json.schema(t)) catch (_) {
    _ => "{}"
  }
  ParamInfo { name: name, type_name: t.to_string(), json_schema: schema, required: required }
}

/// True for functions that are part of the reflection plumbing itself (this
/// file, by its `_`-prefixed local names), compiler-synthesized companions
/// ($parse, $render_prompt, $spec, $stream), or anything living in a nested
/// namespace (`ns_` directories, e.g. root.internal.default_client) — the
/// console describes the package's public root namespace. All structural
/// rules; no function named.
function _is_internal(name: string) -> bool throws never {
  name.includes("$") || name.starts_with("root._")
    || name == "root.ListFunctions" || name == "root.InvokeFunction"
    || name.replace("root.", "").includes(".")
}

/// Enumerates every invocable function in this package via
/// `reflect.Package.current()` + `reflect.signature()`. Add a function to
/// functions.baml and, on restart, it appears here — nothing changes here.
function ListFunctions() -> FunctionInfo[] throws reflect.errors.CompilationError {
  let app = reflect.Package.current()
  let out: FunctionInfo[] = []
  for (let name in app.functions().keys()) {
    if !_is_internal(name) {
      let f = app.get_function<reflect.AnyFunction>(name)
      if f != null {
        let sig = reflect.signature(f)
        let params: ParamInfo[] = []
        for (let arg in sig.args) {
          params.push(_param_info(arg.name, arg.type, true))
        }
        for (let key in sig.opts.keys()) {
          let opt = sig.opts.get(key)
          if opt != null {
            let info = _param_info(key, opt.type, false)
            // Skip optional params with no JSON Schema shape (e.g. the
            // compiler-injected per-call `client` override on LLM
            // functions) — there is nothing a generated form could render.
            if info.json_schema != "{}" {
              params.push(info)
            }
          }
        }
        let returns_schema = baml.json.stringify(baml.json.schema(sig.returns)) catch (_) {
          _ => "{}"
        }
        out.push(FunctionInfo {
          name: name,
          docstring: sig.docstring,
          params: params,
          returns_type_name: sig.returns.to_string(),
          returns_json_schema: returns_schema,
          throws_type_name: sig.errors.to_string(),
        })
      }
    }
  }
  out
}

/// The result of a reflective invocation: exactly one of `value` (success)
/// or `error_type` + `error_message` (failure) is populated.
class InvokeResult {
  ok bool
  value unknown?
  error_type string?
  error_message string?
}

function _decode_arg(raw_json: string, t: reflect.Type) -> InvokeResult throws never {
  let jval = baml.json.parse(raw_json) catch (_) {
    _ => null
  }
  if jval == null && raw_json != "null" {
    return InvokeResult { ok: false, value: null, error_type: "DecodeError", error_message: "not valid JSON" }
  }
  // A decode failure has to be reported, not swallowed: mapping it to `null`
  // would be indistinguishable from a parameter that is legitimately null, so
  // the bad value would reach reflect.call_any and come back as the far less
  // helpful "expected float, got null".
  let decoded = baml.json.from_json<unreflect(t)>(jval) catch (_) {
    _ => {
      return InvokeResult {
        ok: false, value: null, error_type: "DecodeError",
        error_message: "not a valid " + t.to_string(),
      }
    }
  }
  InvokeResult { ok: true, value: decoded, error_type: null, error_message: null }
}

/// Calls the function named `name` with `args` (each value pre-encoded as a
/// JSON string, decoded against the parameter's *reflected* type), entirely
/// through `reflect.call_any` — no per-function branch anywhere in this file.
///
/// `name` need not be a "demo" function: passing a compiler-synthesized
/// companion like `root.SummarizeText$parse` works exactly the same way,
/// which is how mock mode replays a canned model response (see
/// backend/src/invoke.ts) without this function ever knowing about it.
function InvokeFunction(name: string, args: map<string, string>) -> InvokeResult throws reflect.errors.CompilationError {
  let app = reflect.Package.current()
  let f = app.get_function<reflect.AnyFunction>(name)
  if f == null {
    return InvokeResult { ok: false, value: null, error_type: "NotFound", error_message: "no such function: " + name }
  }

  let sig = reflect.signature(f)
  let coerced: map<string, unknown> = {}
  for (let arg in sig.args) {
    let raw = args.get(arg.name)
    if raw != null {
      let decoded = _decode_arg(raw, arg.type)
      if decoded.ok {
        coerced.set(arg.name, decoded.value)
      } else {
        return InvokeResult { ok: false, value: null, error_type: "InvalidArgument", error_message: "'" + arg.name + "': " + (decoded.error_message ?? "invalid value") }
      }
    }
  }
  for (let key in sig.opts.keys()) {
    let opt = sig.opts.get(key)
    if opt != null {
      let raw = args.get(key)
      if raw != null {
        let decoded = _decode_arg(raw, opt.type)
        if decoded.ok {
          coerced.set(key, decoded.value)
        } else {
          return InvokeResult { ok: false, value: null, error_type: "InvalidArgument", error_message: "'" + key + "': " + (decoded.error_message ?? "invalid value") }
        }
      }
    }
  }

  let value = reflect.call_any(f, coerced) catch (e) {
    _ => {
      if e is reflect.InvalidArgumentError {
        return InvokeResult {
          ok: false, value: null, error_type: "InvalidArgument",
          error_message: "'" + e.argument + "': expected " + e.expected.to_string() + ", got " + e.got.to_string(),
        }
      }
      // Any other thrown value is `unknown` here — bare `reflect.AnyFunction`
      // pins `Throws = unknown`. Reflect its runtime type by name and encode
      // its fields generically; this is what makes the throws channel work
      // for a function this dispatcher has never seen before.
      return InvokeResult {
        ok: false, value: null, error_type: reflect.Type.of_value(e).to_string(),
        error_message: baml.json.to_string(e) catch (_) { _ => "<error details unavailable>" },
      }
    }
  }
  InvokeResult { ok: true, value: value, error_type: null, error_message: null }
}
