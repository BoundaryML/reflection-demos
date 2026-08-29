// Fixed-order categorical slots (never reassigned by rank) so a category
// keeps its color as others are added or removed around it.
const SLOT_COUNT = 8;

export function categorySlot(id: number): number {
  return ((id % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT;
}

export function categoryColorVar(id: number): string {
  return `var(--cat-${categorySlot(id)})`;
}
