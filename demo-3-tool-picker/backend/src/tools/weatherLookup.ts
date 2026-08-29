// No external weather API (and no API key to configure) — a small
// deterministic generator seeded by the city name, so the same city always
// reports the same conditions within a run. Clearly labeled "simulated" in
// the UI; this tool exists to demonstrate reflection dispatch, not to be a
// real weather service.
const CONDITIONS = ["clear skies", "scattered clouds", "light rain", "overcast", "sunny", "windy"];

function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface WeatherLookupArgs {
  location: string;
}

export interface WeatherLookupResult {
  location: string;
  condition: string;
  temperature_c: number;
  humidity_percent: number;
  summary: string;
}

export function runWeatherLookup(args: WeatherLookupArgs): WeatherLookupResult {
  const seed = seedFrom(args.location.trim().toLowerCase());
  const condition = CONDITIONS[seed % CONDITIONS.length];
  const temperature_c = 4 + (seed % 30);
  const humidity_percent = 30 + ((seed >> 3) % 60);
  return {
    location: args.location,
    condition,
    temperature_c,
    humidity_percent,
    summary: `${args.location}: ${condition}, ${temperature_c}°C, ${humidity_percent}% humidity (simulated)`,
  };
}
