import { useState } from "react";
import type { ParamInfo } from "../types";
import { classify } from "../schema";

interface Props {
  params: ParamInfo[];
  disabled: boolean;
  onSubmit: (args: Record<string, string>) => void;
}

/** Builds the InvokeFunction-shaped args map (every value JSON-encoded) from raw widget state. */
function buildArgs(params: ParamInfo[], values: Record<string, string>): Record<string, string> {
  const args: Record<string, string> = {};
  for (const p of params) {
    const raw = values[p.name] ?? "";
    const kind = classify(p.json_schema);

    if (kind.kind === "boolean") {
      args[p.name] = JSON.stringify(raw === "true");
      continue;
    }
    // Optional + left blank: omit the key entirely so the callee's own
    // default fires (this is the exact behavior reflect.call_any documents).
    if (!p.required && raw.trim() === "") continue;

    if (kind.kind === "number") {
      const n = Number(raw);
      args[p.name] = JSON.stringify(Number.isFinite(n) ? n : 0);
    } else if (kind.kind === "string-array") {
      const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!p.required && items.length === 0) continue;
      args[p.name] = JSON.stringify(items);
    } else if (kind.kind === "enum") {
      args[p.name] = JSON.stringify(raw || kind.options[0]);
    } else if (kind.kind === "raw") {
      args[p.name] = raw.trim() === "" ? "null" : raw;
    } else {
      args[p.name] = JSON.stringify(raw);
    }
  }
  return args;
}

function Field({
  param,
  value,
  onChange,
}: {
  param: ParamInfo;
  value: string;
  onChange: (v: string) => void;
}) {
  const kind = classify(param.json_schema);

  if (kind.kind === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === "true"}
        onChange={(e) => onChange(e.target.checked ? "true" : "false")}
      />
    );
  }
  if (kind.kind === "enum") {
    return (
      <select value={value || kind.options[0]} onChange={(e) => onChange(e.target.value)}>
        {kind.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (kind.kind === "number") {
    return (
      <input
        type="number"
        step="any"
        value={value}
        placeholder={param.required ? "required" : "optional"}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (kind.kind === "string-array") {
    return (
      <input
        type="text"
        value={value}
        placeholder="comma, separated, values"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (kind.kind === "raw") {
    return (
      <textarea
        value={value}
        rows={2}
        placeholder="raw JSON value"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      placeholder={param.required ? "required" : "optional"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DynamicForm({ params, disabled, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form
      className="dynamic-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(buildArgs(params, values));
      }}
    >
      {params.length === 0 ? (
        <p className="no-params">takes no arguments</p>
      ) : (
        params.map((p) => (
          <label key={p.name} className="field">
            <span className="field-label">
              {p.name}
              <span className="field-type">{p.type_name}</span>
              {!p.required && <span className="field-optional">optional</span>}
            </span>
            <Field
              param={p}
              value={values[p.name] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [p.name]: v }))}
            />
          </label>
        ))
      )}
      <button type="submit" disabled={disabled}>
        {disabled ? "Invoking…" : "Invoke"}
      </button>
    </form>
  );
}
