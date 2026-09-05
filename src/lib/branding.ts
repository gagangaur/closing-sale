// Single source for brand strings that must never drift between the site,
// the shareable message and metadata. Everything customer-facing that the
// shop may want to edit lives in app_settings — these are only fallbacks
// and the policy sentence that must be reproduced verbatim.

export const DEFAULT_SHOP_NAME = "Radha Krishna Book Depo";

/** Mandated wording — keep EXACTLY as is. */
export const POLICY_LINE =
  "Final sale — no returns/exchanges · No home delivery · Cash preferred, UPI accepted at the shop · No online payment.";
