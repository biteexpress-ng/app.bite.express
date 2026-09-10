import type { CartLine } from "@/lib/cart-store";

/** The server truncates at 255; do it here too so what the customer
 *  sees in the cart is what the store will read. */
const MAX_NOTE = 255;

/**
 * Build the `item_notes` map for POST /customer/order/price-check.
 *
 * Keyed by **item_id**, not by the cart's own line key and not by
 * order_detail_id: at request time no order detail exists yet, and the
 * cart rows are deleted before the server copies the notes across. This
 * is the single easiest field in the contract to get wrong (contract 3.1).
 *
 * Two cart lines of the same item collapse to one note. The last
 * non-empty one wins, so an empty note on a second line never erases a
 * real note on the first.
 */
export function buildItemNotes(lines: CartLine[]): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const line of lines) {
    const note = line.note?.trim();
    if (!note) continue;
    notes[String(line.itemId)] = note.slice(0, MAX_NOTE);
  }
  return notes;
}

/**
 * Write a note against every cart line of the keyed line's item.
 *
 * The cart shows one note per item id on all of that item's lines
 * (see buildItemNotes), so a write from any of those lines has to reach
 * all of them. Writing only the keyed line lets a note left on a sibling
 * outrank it: clearing the field would save an empty note and then
 * immediately re-render the sibling's, so the note could not be cleared
 * from any line but the one it was typed on.
 */
export function applyLineNote(
  lines: CartLine[],
  key: string,
  note: string,
): CartLine[] {
  const target = lines.find((l) => l.key === key);
  if (!target) return lines;
  const trimmed = note.trim().slice(0, MAX_NOTE);
  return lines.map((line) => {
    if (line.itemId !== target.itemId) return line;
    if (!trimmed) {
      const rest = { ...line };
      delete rest.note;
      return rest;
    }
    return { ...line, note: trimmed };
  });
}
