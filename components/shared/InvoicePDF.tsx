/**
 * @react-pdf document for a single invoice. Visually mirrors the on-screen
 * `InvoiceDocument` component (`components/shared/InvoiceDocument.tsx`) but
 * built with @react-pdf primitives because the HTML version cannot be
 * rasterised to a downloadable PDF in the browser.
 *
 * Imports the heavy @react-pdf library — keep this file out of any static
 * import graph reachable from the initial route bundle. The hook
 * `useInvoicePdfDownload` dynamic-imports this module on click, ensuring the
 * `/invoices` route stays slim.
 *
 * The component reflects the invoice's CURRENT state at the moment of
 * download (matches the on-screen HTML's behaviour). If the invoice is
 * updated later, regenerate the PDF.
 *
 * The Tailwind tokens used in the HTML version are restated here as hex
 * literals because @react-pdf understands inline `StyleSheet.create` only,
 * not Tailwind class names.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoiceDocumentData } from "@/hooks/use-invoice-document";
import { formatCurrency } from "@/lib/currency";
import { fmtDayMonthYear } from "@/lib/dateFormat";
import type { InvoiceStatus } from "@/lib/invoiceDocumentDisplay";
import { SCHOOL_NAME } from "@/lib/schoolBrand";

// ── Tokens ──────────────────────────────────────────────────────────────────
// Hex equivalents of the Tailwind utilities used in the HTML version so the
// rendered PDF visually matches the screen view.
const COLOR = {
  schoolGreen: "#018737",
  schoolYellow: "#F88B0E",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray700: "#374151",
  gray900: "#111827",
  red600: "#dc2626",
  green700: "#15803d",
  blue700: "#1d4ed8",
  white: "#ffffff",
} as const;

// ── Style sheet ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.white,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 10,
    color: COLOR.gray900,
    fontFamily: "Helvetica",
  },
  // Header row
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginRight: 12,
  },
  schoolName: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLOR.gray900,
  },
  schoolAddress: {
    fontSize: 9,
    color: COLOR.gray500,
    marginTop: 2,
  },
  invoiceMeta: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: -0.5,
    color: COLOR.gray900,
  },
  invoiceNumber: {
    fontSize: 10,
    color: COLOR.gray500,
    marginTop: 2,
    fontWeight: "medium",
  },
  statusPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: "medium",
  },
  // Separators
  separator: {
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.gray200,
  },
  separatorThin: {
    marginVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.gray200,
  },
  // Bill to + dates
  twoColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  column: {
    width: "48%",
  },
  columnRight: {
    width: "48%",
    alignItems: "flex-end",
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLOR.gray400,
  },
  studentName: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "bold",
    color: COLOR.gray900,
  },
  studentMeta: {
    color: COLOR.gray500,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 220,
    marginTop: 4,
  },
  dateLabel: {
    color: COLOR.gray500,
  },
  dateValue: {
    fontWeight: "medium",
  },
  dateValueOverdue: {
    fontWeight: "medium",
    color: COLOR.red600,
  },
  // Line items table
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  itemsHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLOR.gray400,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLOR.gray200,
  },
  itemDescription: {
    flexGrow: 1,
    flexShrink: 1,
    color: COLOR.gray700,
    paddingRight: 12,
  },
  itemAmount: {
    fontWeight: "medium",
  },
  itemEmpty: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLOR.gray200,
    color: COLOR.gray500,
    fontStyle: "italic",
    textAlign: "center",
  },
  // Totals
  totalsBlock: {
    marginLeft: "auto",
    width: 220,
    marginTop: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalsLabel: {
    color: COLOR.gray500,
  },
  paidRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    color: COLOR.green700,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 4,
  },
  balanceClearedAmount: {
    color: COLOR.green700,
  },
  balanceDueAmount: {
    color: COLOR.red600,
  },
  // Notes
  notesBlock: {
    marginTop: 32,
    padding: 12,
    backgroundColor: COLOR.gray50,
    borderRadius: 6,
  },
  notesBody: {
    marginTop: 4,
    color: COLOR.gray700,
  },
  // Footer
  footer: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 9,
    color: COLOR.gray500,
  },
});

// Background + text colour for the status pill, mirroring the HTML's
// statusBadgeClass mapping but expressed as hex pairs.
const STATUS_PILL: Record<
  InvoiceStatus,
  { background: string; color: string }
> = {
  draft: { background: "#e5e7eb", color: "#374151" },
  issued: { background: "#dbeafe", color: COLOR.blue700 },
  paid: { background: "#dcfce7", color: COLOR.green700 },
  overdue: { background: "#fee2e2", color: COLOR.red600 },
  voided: { background: "#e5e7eb", color: COLOR.gray500 },
};

function statusLabel(status: InvoiceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export interface InvoicePDFProps {
  data: InvoiceDocumentData;
  /**
   * Pre-loaded base64 data URI of the school logo. Injected by the caller so
   * the PDF component itself is a pure function of its props — no network
   * fetches happen during render.
   */
  logoDataUri: string;
}

export function InvoicePDF({ data, logoDataUri }: InvoicePDFProps) {
  const status = data.status as InvoiceStatus;
  const pill = STATUS_PILL[status];

  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <Image src={logoDataUri} style={styles.logo} />
            <View>
              <Text style={styles.schoolName}>{SCHOOL_NAME}</Text>
              {data.campusAddress ? (
                <Text style={styles.schoolAddress}>{data.campusAddress}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: pill.background, color: pill.color },
              ]}
            >
              <Text>{statusLabel(status)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Bill to + dates */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.studentName}>{data.studentName}</Text>
            <Text style={styles.studentMeta}>
              {data.studentNumber} · {data.standardLevelName}
            </Text>
            <Text style={styles.studentMeta}>{data.campusName}</Text>
            <Text style={styles.studentMeta}>{data.academicYearName}</Text>
          </View>
          <View style={styles.columnRight}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Issue Date</Text>
              <Text style={styles.dateValue}>
                {fmtDayMonthYear(data.issueDate)}
              </Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Due Date</Text>
              <Text
                style={
                  status === "overdue"
                    ? styles.dateValueOverdue
                    : styles.dateValue
                }
              >
                {fmtDayMonthYear(data.dueDate)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Line items */}
        <View style={styles.itemsHeader}>
          <Text style={styles.itemsHeaderText}>Description</Text>
          <Text style={styles.itemsHeaderText}>Amount</Text>
        </View>
        {data.lineItems.length === 0 ? (
          // Defensive: an invoice without line items shouldn't happen, but if
          // it does we don't want a confusing blank section.
          <Text style={styles.itemEmpty}>No items billed</Text>
        ) : (
          data.lineItems.map((item) => (
            <View style={styles.itemRow} key={item.studentFeeId}>
              <Text style={styles.itemDescription}>{item.description}</Text>
              <Text style={styles.itemAmount}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))
        )}

        <View style={styles.separatorThin} />

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{formatCurrency(data.totalAmount)}</Text>
          </View>
          {data.paidAmount > 0 && (
            <View style={styles.paidRow}>
              <Text>Paid</Text>
              <Text>– {formatCurrency(data.paidAmount)}</Text>
            </View>
          )}
          <View style={styles.separatorThin} />
          <View style={styles.balanceRow}>
            <Text>Balance Due</Text>
            <Text
              style={
                data.balance > 0
                  ? styles.balanceDueAmount
                  : styles.balanceClearedAmount
              }
            >
              {formatCurrency(data.balance)}
            </Text>
          </View>
        </View>

        {/* Notes — render one <Text> per line because @react-pdf does not honour
            CSS `white-space: pre-wrap`. Keys combine the line text with its
            position so duplicate lines (e.g. blank rows) don't collide. */}
        {data.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.notesBody}>
              {data.notes.split("\n").map((line, idx) => (
                <Text key={`${idx}:${line}`}>{line || " "}</Text>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer}>Thank you for your prompt payment.</Text>
      </Page>
    </Document>
  );
}
