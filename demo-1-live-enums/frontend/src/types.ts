export interface Category {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface Ticket {
  id: number;
  customer: string;
  subject: string;
  body: string;
  received_at: string;
  category: string | null;
  classified_at: string | null;
}

export interface Config {
  mode: "mock" | "live";
  model: string;
}
