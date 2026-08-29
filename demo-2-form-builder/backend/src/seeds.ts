import type { FieldKind } from "./db.js";

export type SeedId = "doctor" | "realestate";

export interface PresetField {
  name: string;
  kind: FieldKind;
  options: string[];
  description: string;
}

// ── Starter form designs ────────────────────────────────────────────────
// "Load starter" in the Design tab replaces the current fields with one of
// these. The user is free to edit, remove, or add fields afterward — the
// point is a fast, editable starting point, not a locked template.

export const PRESETS: Record<SeedId, PresetField[]> = {
  doctor: [
    {
      name: "chief_complaint",
      kind: "text",
      options: [],
      description: "the patient's main reason for the visit, in a phrase",
    },
    {
      name: "patient_height_cm",
      kind: "number",
      options: [],
      description: "the patient's height in centimeters",
    },
    {
      name: "symptoms",
      kind: "bulleted_list",
      options: [],
      description: "symptoms the patient reported",
    },
    {
      name: "visit_type",
      kind: "dropdown",
      options: ["new_patient", "follow_up", "urgent_care"],
      description: "the kind of visit this is",
    },
    {
      name: "follow_up_needed",
      kind: "dropdown",
      options: ["yes", "no"],
      description: "whether the patient needs to come back for a follow-up",
    },
  ],
  realestate: [
    {
      name: "property_type",
      kind: "dropdown",
      options: ["single_family", "condo", "townhouse", "multi_family"],
      description: "the kind of property being listed",
    },
    {
      name: "asking_price_usd",
      kind: "number",
      options: [],
      description: "the listing price in US dollars, digits only",
    },
    {
      name: "bedrooms",
      kind: "number",
      options: [],
      description: "number of bedrooms",
    },
    {
      name: "highlights",
      kind: "bulleted_list",
      options: [],
      description: "notable features or selling points",
    },
    {
      name: "listing_status",
      kind: "dropdown",
      options: ["active", "pending", "sold"],
      description: "the current status of the listing",
    },
  ],
};

// ── Seed transcripts ─────────────────────────────────────────────────────
// One "click to fill" sample per domain in the Extract tab.

export const SEED_TRANSCRIPTS: Record<SeedId, string> = {
  doctor: `Patient is a 34-year-old male presenting today for a follow-up visit regarding persistent lower back pain that started about three weeks ago after a gym session. He says the pain is worse in the mornings and improves slightly with stretching. He also mentions occasional numbness radiating down his left leg and some difficulty sleeping because of the discomfort. No fever, no recent injury besides the gym incident. Height today measured at six foot even. Blood pressure and vitals otherwise normal. Given the radiating numbness, I'm recommending an MRI to rule out disc involvement, and we should see him again in two weeks to review the imaging, so plan on a follow-up. In the meantime, prescribed a short course of anti-inflammatories and referred him to physical therapy.`,
  realestate: `Charming single-family home just hit the market in the Maple Heights neighborhood, listed at $625,000. This 4-bedroom, 3-bath property sits on a quarter-acre lot and has been beautifully updated with a chef's kitchen featuring quartz countertops and stainless steel appliances. The primary suite includes a walk-in closet and a spa-style bathroom. Other highlights include a finished basement perfect for a home theater, a two-car garage, and a freshly landscaped backyard with a new deck. The home is close to top-rated schools and just minutes from downtown. Showings start this weekend, the seller is motivated and open to offers, so this one won't stay on the market long.`,
};

// ── Canned extraction results (mock mode) ───────────────────────────────
// What the LLM "would have said" for each seed transcript, keyed by the
// preset field names above. The backend looks values up by field name so
// the demo still works sensibly if the user renames or removes fields.

export const MOCK_EXTRACTIONS: Record<SeedId, Record<string, unknown>> = {
  doctor: {
    chief_complaint: "persistent lower back pain radiating down the left leg",
    patient_height_cm: 183,
    symptoms: [
      "lower back pain, worse in the mornings",
      "numbness radiating down the left leg",
      "difficulty sleeping due to discomfort",
    ],
    visit_type: "follow_up",
    follow_up_needed: "yes",
  },
  realestate: {
    property_type: "single_family",
    asking_price_usd: 625000,
    bedrooms: 4,
    highlights: [
      "chef's kitchen with quartz countertops and stainless steel appliances",
      "finished basement perfect for a home theater",
      "freshly landscaped backyard with a new deck",
      "close to top-rated schools",
    ],
    listing_status: "active",
  },
};

/** Score how well free text matches each seed's vocabulary, and return the best guess. */
export function guessSeed(transcript: string): SeedId {
  const text = transcript.toLowerCase();
  if (text.trim() === SEED_TRANSCRIPTS.doctor.trim()) return "doctor";
  if (text.trim() === SEED_TRANSCRIPTS.realestate.trim()) return "realestate";

  const doctorHints = [
    "patient",
    "visit",
    "symptom",
    "pain",
    "doctor",
    "prescri",
    "diagnos",
    "follow-up",
    "follow up",
  ];
  const realestateHints = [
    "bedroom",
    "listing",
    "home",
    "kitchen",
    "sqft",
    "square feet",
    "price",
    "$",
    "property",
    "neighborhood",
  ];
  const score = (hints: string[]) =>
    hints.reduce((total, hint) => total + (text.includes(hint) ? 1 : 0), 0);

  const doctorScore = score(doctorHints);
  const realestateScore = score(realestateHints);
  return realestateScore > doctorScore ? "realestate" : "doctor";
}
