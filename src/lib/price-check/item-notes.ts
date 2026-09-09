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
