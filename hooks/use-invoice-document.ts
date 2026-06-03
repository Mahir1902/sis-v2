"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  balanceClassFor,
  dueDateClassFor,
  type InvoiceStatus,
} from "@/lib/invoiceDocumentDisplay";

/**
 * Enriched invoice payload as returned by `api.invoices.getInvoiceById` on the
 * happy path (i.e. when the invoice exists). Resolving the type from the
 * Convex generated API keeps the hook in lockstep with the backend — when the
 * query's return shape changes, this type updates automatically and any
 * mismatched consumers fail to compile.
 */
export type InvoiceDocumentData = NonNullable<
  FunctionReturnType<typeof api.invoices.getInvoiceById>
>;

/**
 * Discriminated state returned by `useInvoiceDocument`.
 *
 * Why a discriminated union?  The component needs to render three distinct
 * UIs (skeleton / not-found / document) and a tagged state forces the caller
 * to handle every branch — `null` vs `undefined` checks against a single
 * variable are too easy to invert.
 */
export type UseInvoiceDocumentResult =
  | { state: "loading" }
  | { state: "not-found" }
  | {
      state: "ready";
      invoice: InvoiceDocumentData;
      /** Strongly-typed invoice status — re-exposed so consumers don't re-cast. */
      status: InvoiceStatus;
      /** Pre-computed Tailwind class for the "Balance Due" amount. */
      balanceClass: string;
      /** Pre-computed Tailwind class for the "Due Date" label. */
      dueDateClass: string;
    };

/**
 * Fetches an invoice for the InvoiceDocument view and pre-computes the small
 * derived display classes.
 *
 * Keeps the component body free of `useQuery` plumbing and inline ternaries
 * (CLAUDE.md frontend rule #9). All conditional class logic is delegated to
 * the unit-tested helpers in `lib/invoiceDocumentDisplay.ts` — this hook only
 * wires them up against the live query state.
 *
 * - `state: "loading"`   → query still in-flight (`useQuery` returned `undefined`).
 * - `state: "not-found"` → query resolved to `null` (invoice deleted or access
 *                          denied at the backend layer).
 * - `state: "ready"`     → invoice loaded successfully; `balanceClass` and
 *                          `dueDateClass` are safe to spread straight into JSX.
 */
export function useInvoiceDocument(
  invoiceId: Id<"invoices">,
): UseInvoiceDocumentResult {
  const invoice = useQuery(api.invoices.getInvoiceById, { invoiceId });

  if (invoice === undefined) {
    return { state: "loading" };
  }
  if (invoice === null) {
    return { state: "not-found" };
  }

  // The Convex query stores `status` as a literal union; cast to the shared
  // `InvoiceStatus` (identical union) so the helper signatures line up. The
  // cast happens once here and the typed `status` is exposed on the result so
  // consumers never re-cast.
  const status = invoice.status as InvoiceStatus;

  return {
    state: "ready",
    invoice,
    status,
    balanceClass: balanceClassFor(invoice.balance),
    dueDateClass: dueDateClassFor(status),
  };
}
