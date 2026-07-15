/**
 * Pure rules for offline payment. No React, no fetch, no DOM — this
 * module exists so the gating decision and the form validation can be
 * tested directly, because both are places where a silent mistake is
 * expensive:
 *
 *  - Gating wrong in one direction shows customers an option that does
 *    not work; wrong in the other hides a payment method the business
 *    is actively relying on.
 *  - `is_required` is NOT enforced by the backend (OrderController.php
 *    :470-540 validates only order_id and method_id), so if we don't
 *    enforce it here, blank required fields save happily and the admin
 *    gets a payment record they cannot verify.
 */

export type OfflineMethodField = {
  /** Slugified label, e.g. "bank_name". Display only. */
  input_name: string;
  /** The value to show the customer, e.g. "GTBank". */
  input_data: string;
};

export type OfflineMethodInformation = {
  /** The key to POST back VERBATIM. Slugified server-side
   *  (OfflinePaymentMethodController.php:61-82), so "Sender's Name"
   *  arrives as `senders_name`. Never construct this client-side. */
  customer_input: string;
  customer_placeholder: string;
  /** Arrives as 0|1 but tolerate booleans and strings. */
  is_required: number | boolean | string;
};

export type OfflinePaymentMethod = {
  id: number;
  method_name: string;
  /** Read-only: the account the customer pays INTO. */
  method_fields: OfflineMethodField[];
  /** The form to render. */
  method_informations: OfflineMethodInformation[];
  status: number;
};

function isTruthyFlag(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

/**
 * All three must hold for the Pay Offline option to be offered.
 *
 * Only `offlinePaymentStatus` is enforced by the backend (PlaceNewOrder
 * .php:681-685). The per-zone flag is advisory and never checked during
 * order placement, but the Flutter app gates on it, so ignoring it here
 * would make the two clients disagree in a zone deliberately switched
 * off.
 */
export function canUseOfflinePayment(input: {
  offlinePaymentStatus: number | null | undefined;
  zoneOfflinePayment: boolean | number | null | undefined;
  methods: OfflinePaymentMethod[] | null | undefined;
}): boolean {
  if (input.offlinePaymentStatus !== 1) return false;
  if (!isTruthyFlag(input.zoneOfflinePayment)) return false;
  if (!input.methods || input.methods.length === 0) return false;
  return true;
}

/**
 * Returns a map of customer_input -> error message. Empty means valid.
 */
export function validateOfflineForm(
  method: OfflinePaymentMethod,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const info of method.method_informations ?? []) {
    if (!isTruthyFlag(info.is_required)) continue;
    const value = (values[info.customer_input] ?? "").trim();
    if (!value) {
      errors[info.customer_input] = `${info.customer_placeholder} is required.`;
    }
  }
  return errors;
}
