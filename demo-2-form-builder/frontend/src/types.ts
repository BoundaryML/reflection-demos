export type FieldKind = "text" | "number" | "dropdown" | "bulleted_list";

export interface FormField {
  id: number;
  name: string;
  kind: FieldKind;
  options: string[];
  description: string;
  position: number;
}

export interface NewField {
  name: string;
  kind: FieldKind;
  options: string[];
  description: string;
}

export interface ExtractionOutcome {
  fields: Record<string, string>;
  mock: boolean;
}

export interface ModeInfo {
  mock: boolean;
  reason: string;
}

export type SeedId = "doctor" | "realestate";
