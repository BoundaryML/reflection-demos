export const TOOL_IDS = ["calculator", "unit_converter", "note_saver", "weather"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolMeta {
  id: ToolId;
  label: string;
  icon: string;
  description: string;
  /** The BAML class name minted by `reflect.class.new` for this tool. */
  className: string;
  example: string;
}

export const TOOLS: Record<ToolId, ToolMeta> = {
  calculator: {
    id: "calculator",
    label: "Calculator",
    icon: "\u{1F9EE}",
    description: "Evaluates arithmetic expressions.",
    className: "Calculator",
    example: "What's 12 * (7 + 5)?",
  },
  unit_converter: {
    id: "unit_converter",
    label: "Unit Converter",
    icon: "\u{1F4D0}",
    description: "Converts between length, weight, and temperature units.",
    className: "UnitConverter",
    example: "Convert 10 km to miles",
  },
  note_saver: {
    id: "note_saver",
    label: "Note Saver",
    icon: "\u{1F4DD}",
    description: "Saves a titled note to the database.",
    className: "NoteSaver",
    example: "Remember to water the plants on Friday",
  },
  weather: {
    id: "weather",
    label: "Weather Lookup",
    icon: "☀️",
    description: "Looks up the (simulated) weather for a city.",
    className: "WeatherLookup",
    example: "What's the weather like in Tokyo?",
  },
};
