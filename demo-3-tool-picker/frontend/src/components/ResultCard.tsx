import type { ToolId } from "../api.js";

interface CalculatorResult {
  expression: string;
  value: number;
}
interface ConverterResult {
  input: string;
  output: string;
}
interface NoteResult {
  id: number;
  title: string;
  body: string;
}
interface WeatherResult {
  location: string;
  condition: string;
  temperature_c: number;
  humidity_percent: number;
}

export default function ResultCard({ tool, result }: { tool: ToolId; result: unknown }) {
  switch (tool) {
    case "calculator": {
      const r = result as CalculatorResult;
      return (
        <div className="result-card calculator">
          <code className="expr">{r.expression}</code>
          <span className="eq">=</span>
          <span className="value">{r.value}</span>
        </div>
      );
    }
    case "unit_converter": {
      const r = result as ConverterResult;
      return (
        <div className="result-card converter">
          <span className="value">{r.input}</span>
          <span className="arrow">→</span>
          <span className="value">{r.output}</span>
        </div>
      );
    }
    case "note_saver": {
      const r = result as NoteResult;
      return (
        <div className="result-card note">
          <span className="note-title">{r.title}</span>
          <span className="note-body">{r.body}</span>
          <span className="note-meta">saved as note #{r.id}</span>
        </div>
      );
    }
    case "weather": {
      const r = result as WeatherResult;
      return (
        <div className="result-card weather">
          <span className="city">{r.location}</span>
          <span className="temp">{r.temperature_c}°C</span>
          <span className="condition">
            {r.condition}, {r.humidity_percent}% humidity
          </span>
        </div>
      );
    }
    default:
      return null;
  }
}
