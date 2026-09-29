import { createLucideIcon } from "lucide-react";

/**
 * Lucide's Receipt with a naira sign in place of its dollar sign. Lucide
 * ships receipts for several currencies but not the naira. The outline
 * path is copied from lucide-react's receipt icon so it sits alongside
 * the other tab icons at the same weight.
 */
export const ReceiptNaira = createLucideIcon("receipt-naira", [
  ["path", { d: "M9 16.5v-9l6 9v-9", key: "naira-n" }],
  ["path", { d: "M7.5 10.5h9", key: "naira-bar-1" }],
  ["path", { d: "M7.5 13.5h9", key: "naira-bar-2" }],
  [
    "path",
    {
      d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",
      key: "receipt-outline",
    },
  ],
]);
