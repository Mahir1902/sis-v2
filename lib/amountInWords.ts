/**
 * Renders a BDT amount as English words using Indian numbering grouping
 * (lakh / crore), which is the convention parents and accountants in
 * Bangladesh read by default. Used on the printed Money Receipt PDF —
 * see `components/receipts/ReceiptDocument.tsx`.
 *
 * Paisa is supported (1 taka = 100 paisa). Fractional paisa is rounded to
 * the nearest whole paisa via banker-safe `Math.round` after scaling.
 *
 * @example
 *   amountInWords(0)        // "Zero Taka Only"
 *   amountInWords(100)      // "One Hundred Taka Only"
 *   amountInWords(150000)   // "One Lakh Fifty Thousand Taka Only"
 *   amountInWords(100.5)    // "One Hundred Taka and Fifty Paisa Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
];

const TEENS = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TENS[t] : `${TENS[t]} ${ONES[u]}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(" ");
}

function intToWords(n: number): string {
  if (n === 0) return "";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const hundred = n % 1_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred > 0) parts.push(threeDigits(hundred));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      `amountInWords requires a finite, non-negative amount; got ${amount}`,
    );
  }

  const totalPaisa = Math.round(amount * 100);
  const taka = Math.floor(totalPaisa / 100);
  const paisa = totalPaisa % 100;

  if (taka === 0 && paisa === 0) return "Zero Taka Only";

  const parts: string[] = [];
  if (taka > 0) parts.push(`${intToWords(taka)} Taka`);
  if (paisa > 0) {
    if (taka > 0) parts.push("and");
    parts.push(`${twoDigits(paisa)} Paisa`);
  }
  parts.push("Only");
  return parts.join(" ");
}
