export interface Preset {
  id: string;
  label: string;
  source: string;
  document: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'invoice',
    label: 'Freight invoice',
    source: `class Invoice {
  vendor string
  invoice_number string
  issued_on string @description("ISO date, YYYY-MM-DD")
  currency string
  total float
  line_items string[] @description("one item per entry: description and amount")
}
`,
    document: `Vendor: Northwind Freight Ltd
Invoice Number: NW-2291
Issued On: 2026-08-02
Currency: USD

  Pallet handling and dock storage        1,240.00
  Refrigerated transit, long haul           915.50
  Customs brokerage                         220.00

Total: 2375.50
`,
  },
  {
    id: 'visit',
    label: 'Clinical visit note',
    source: `class VisitNote {
  chief_complaint string
  height_cm int
  weight_kg float
  blood_pressure string?
  assessment string
  plan string[] @description("short imperative phrases")
}
`,
    document: `Chief Complaint: dry cough, worse at night, three weeks
Height cm: 183
Weight kg: 79.4
Blood Pressure: 128/82
Assessment: likely post-viral cough, no red flags

Plan:
- start inhaled corticosteroid
- review in two weeks
- chest x-ray if no improvement
`,
  },
  {
    id: 'posting',
    label: 'Job posting',
    source: `class JobPosting {
  title string
  company string
  seniority string @description("one of: junior, mid, senior, staff")
  location string?
  salary_min int?
  salary_max int?
  must_have_skills string[]
}
`,
    document: `Title: Compiler Engineer
Company: Meridian Systems
Seniority: senior
Location: remote, EU timezones
Salary Min: 145000
Salary Max: 185000
Must Have Skills: Rust, incremental compilation, LLVM, type inference
`,
  },
  {
    id: 'broken',
    label: 'A schema with mistakes',
    source: `// Two real mistakes. The compiler finds them both before you
// finish reading this comment.

class Shipment {
  tracking_number string
  weight_kg
  delivered bool
  destination Address
}
`,
    document: `Tracking Number: 1Z-88-4402
Weight kg: 12.4
Delivered: yes
`,
  },
];
