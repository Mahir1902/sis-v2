import { describe, expect, it } from "vitest";
import {
  renderInitialInvoiceEmail,
  renderReceiptInvoiceEmail,
  renderReminderInvoiceEmail,
} from "./invoiceEmailTemplates";

describe("invoice email templates", () => {
  describe("initial", () => {
    it("substitutes invoice variables into the subject and body", () => {
      const rendered = renderInitialInvoiceEmail({
        invoiceNumber: "INV-2026-001",
        studentName: "Zainab Rahman",
        billingContactName: "Mr Rahman",
        schoolName: "Greenfield School",
        standardLevel: "Grade 03",
        issueDate: "01 Apr 2026",
        dueDate: "15 Apr 2026",
        amountDue: "12,000",
      });

      expect(rendered.subject).toBe(
        "Invoice INV-2026-001 for Zainab Rahman — Greenfield School",
      );
      expect(rendered.body).toContain("Dear Mr Rahman,");
      expect(rendered.body).toContain("Zainab Rahman (Grade 03)");
      expect(rendered.body).toContain("Invoice number: INV-2026-001");
      expect(rendered.body).toContain("Issue date:     01 Apr 2026");
      expect(rendered.body).toContain("Due date:       15 Apr 2026");
      expect(rendered.body).toContain("Amount due:     BDT 12,000");
      expect(rendered.body).toContain("Greenfield School — Finance Office");
    });

    it("leaves no unreplaced {{variables}} in the output", () => {
      const rendered = renderInitialInvoiceEmail({
        invoiceNumber: "INV-2026-001",
        studentName: "Zainab",
        billingContactName: "Mr R",
        schoolName: "School",
        standardLevel: "Grade 03",
        issueDate: "01 Apr 2026",
        dueDate: "15 Apr 2026",
        amountDue: "12,000",
      });
      expect(rendered.subject).not.toMatch(/\{\{[^}]+\}\}/);
      expect(rendered.body).not.toMatch(/\{\{[^}]+\}\}/);
    });
  });

  describe("reminder", () => {
    it("uses the reminder subject and body with balanceDue", () => {
      const rendered = renderReminderInvoiceEmail({
        invoiceNumber: "INV-2026-001",
        studentName: "Zainab Rahman",
        billingContactName: "Mr Rahman",
        schoolName: "Greenfield School",
        dueDate: "15 Apr 2026",
        balanceDue: "8,500",
      });
      expect(rendered.subject).toBe(
        "Reminder — Invoice INV-2026-001 outstanding for Zainab Rahman",
      );
      expect(rendered.body).toContain("This is a reminder");
      expect(rendered.body).toContain("Invoice number:    INV-2026-001");
      expect(rendered.body).toContain("Original due date: 15 Apr 2026");
      expect(rendered.body).toContain("Balance due:       BDT 8,500");
      expect(rendered.body).toContain("Greenfield School — Finance Office");
      expect(rendered.body).not.toMatch(/\{\{[^}]+\}\}/);
    });
  });

  describe("receipt", () => {
    it("uses the receipt subject and body with paid amount and mode", () => {
      const rendered = renderReceiptInvoiceEmail({
        invoiceNumber: "INV-2026-001",
        studentName: "Zainab Rahman",
        billingContactName: "Mr Rahman",
        schoolName: "Greenfield School",
        amountPaid: "12,000",
        paidAt: "20 Apr 2026",
        paymentMode: "Bank Transfer",
      });
      expect(rendered.subject).toBe(
        "Receipt — Invoice INV-2026-001 paid for Zainab Rahman",
      );
      expect(rendered.body).toContain("Thank you for your payment");
      expect(rendered.body).toContain("Invoice number: INV-2026-001");
      expect(rendered.body).toContain("Amount paid:    BDT 12,000");
      expect(rendered.body).toContain("Payment date:   20 Apr 2026");
      expect(rendered.body).toContain("Payment mode:   Bank Transfer");
      expect(rendered.body).not.toMatch(/\{\{[^}]+\}\}/);
    });
  });
});
