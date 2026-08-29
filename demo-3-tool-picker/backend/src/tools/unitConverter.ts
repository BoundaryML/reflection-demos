type UnitKind = "length" | "weight" | "temperature";

// Every unit's factor into the kind's base unit (meters / kilograms).
// Temperature is handled separately since it's affine, not linear.
const LENGTH_TO_METERS: Record<string, number> = {
  m: 1, meter: 1, meters: 1,
  km: 1000, kilometer: 1000, kilometers: 1000,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  mi: 1609.344, mile: 1609.344, miles: 1609.344,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
};

const WEIGHT_TO_KG: Record<string, number> = {
  kg: 1, kilogram: 1, kilograms: 1,
  g: 0.001, gram: 0.001, grams: 0.001,
  lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237,
  oz: 0.028349523125, ounce: 0.028349523125, ounces: 0.028349523125,
};

const TEMPERATURE_UNITS = new Set([
  "c", "celsius", "centigrade",
  "f", "fahrenheit",
  "k", "kelvin",
]);

function normalize(unit: string): string {
  return unit.trim().toLowerCase();
}

function kindOf(unit: string): UnitKind | null {
  if (unit in LENGTH_TO_METERS) return "length";
  if (unit in WEIGHT_TO_KG) return "weight";
  if (TEMPERATURE_UNITS.has(unit)) return "temperature";
  return null;
}

function toCelsius(value: number, unit: string): number {
  if (unit === "c" || unit === "celsius" || unit === "centigrade") return value;
  if (unit === "f" || unit === "fahrenheit") return ((value - 32) * 5) / 9;
  return value - 273.15; // kelvin
}

function fromCelsius(value: number, unit: string): number {
  if (unit === "c" || unit === "celsius" || unit === "centigrade") return value;
  if (unit === "f" || unit === "fahrenheit") return (value * 9) / 5 + 32;
  return value + 273.15; // kelvin
}

export interface UnitConverterArgs {
  value: number;
  from_unit: string;
  to_unit: string;
}

export interface UnitConverterResult {
  input: string;
  output: string;
  value: number;
  summary: string;
}

export class UnitConverterError extends Error {}

export function runUnitConverter(args: UnitConverterArgs): UnitConverterResult {
  const from = normalize(args.from_unit);
  const to = normalize(args.to_unit);
  const fromKind = kindOf(from);
  const toKind = kindOf(to);

  if (!fromKind) throw new UnitConverterError(`unrecognized unit "${args.from_unit}"`);
  if (!toKind) throw new UnitConverterError(`unrecognized unit "${args.to_unit}"`);
  if (fromKind !== toKind) {
    throw new UnitConverterError(`can't convert ${fromKind} ("${args.from_unit}") to ${toKind} ("${args.to_unit}")`);
  }

  let result: number;
  if (fromKind === "temperature") {
    result = fromCelsius(toCelsius(args.value, from), to);
  } else if (fromKind === "length") {
    result = (args.value * LENGTH_TO_METERS[from]) / LENGTH_TO_METERS[to];
  } else {
    result = (args.value * WEIGHT_TO_KG[from]) / WEIGHT_TO_KG[to];
  }

  const rounded = Math.round(result * 1000) / 1000;
  return {
    input: `${args.value} ${args.from_unit}`,
    output: `${rounded} ${args.to_unit}`,
    value: rounded,
    summary: `${args.value} ${args.from_unit} ≈ ${rounded} ${args.to_unit}`,
  };
}
