/**
 * Whether this cart goes to the store for pricing instead of to checkout.
 *
 * `price_check_enabled` is the server's already-combined answer across the
 * master switch, the module switch and the per-store switch. Clients must
 * not combine those three themselves (contract 2.1), and there is no
 * per-store flag on the config endpoint to combine it with.
 */
export function isPriceRequestCart(
  store: { price_check_enabled?: boolean } | null | undefined,
): boolean {
  return store?.price_check_enabled === true;
}
