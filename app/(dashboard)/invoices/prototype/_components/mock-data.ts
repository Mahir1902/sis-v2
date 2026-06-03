// PROTOTYPE — static mock data, delete with prototype

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  studentName: string;
  studentId: string;
  class: string;
  campus: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  total: number;
  paidAmount: number;
}

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "1",
    number: "INV-2025-001",
    studentName: "Amina Yusuf",
    studentId: "STU-0042",
    class: "Grade 9",
    campus: "Main Campus",
    issueDate: "2025-05-01",
    dueDate: "2025-05-15",
    status: "paid",
    items: [
      { description: "Tuition Fee – Term 2", amount: 45000 },
      { description: "Library Fee", amount: 2000 },
      { description: "Sports Fee", amount: 1500 },
    ],
    total: 48500,
    paidAmount: 48500,
  },
  {
    id: "2",
    number: "INV-2025-002",
    studentName: "Khalid Hassan",
    studentId: "STU-0078",
    class: "Grade 11",
    campus: "Main Campus",
    issueDate: "2025-05-01",
    dueDate: "2025-05-15",
    status: "overdue",
    items: [
      { description: "Tuition Fee – Term 2", amount: 50000 },
      { description: "Lab Fee", amount: 3500 },
    ],
    total: 53500,
    paidAmount: 0,
  },
  {
    id: "3",
    number: "INV-2025-003",
    studentName: "Fatima Al-Rashid",
    studentId: "STU-0113",
    class: "KG-2",
    campus: "Branch A",
    issueDate: "2025-05-05",
    dueDate: "2025-05-20",
    status: "sent",
    items: [
      { description: "Tuition Fee – Term 2", amount: 35000 },
      { description: "Meals Fee", amount: 8000 },
    ],
    total: 43000,
    paidAmount: 0,
  },
  {
    id: "4",
    number: "INV-2025-004",
    studentName: "Omar Suleiman",
    studentId: "STU-0201",
    class: "Grade 5",
    campus: "Main Campus",
    issueDate: "2025-05-08",
    dueDate: "2025-05-22",
    status: "draft",
    items: [
      { description: "Tuition Fee – Term 2", amount: 40000 },
      { description: "Transport Fee", amount: 6000 },
    ],
    total: 46000,
    paidAmount: 0,
  },
  {
    id: "5",
    number: "INV-2025-005",
    studentName: "Zainab Mbeki",
    studentId: "STU-0059",
    class: "Grade 7",
    campus: "Branch B",
    issueDate: "2025-04-28",
    dueDate: "2025-05-12",
    status: "paid",
    items: [
      { description: "Tuition Fee – Term 2", amount: 42000 },
      { description: "Exam Fee", amount: 2500 },
    ],
    total: 44500,
    paidAmount: 44500,
  },
  {
    id: "6",
    number: "INV-2025-006",
    studentName: "Ibrahim Nkosi",
    studentId: "STU-0334",
    class: "Grade 12",
    campus: "Main Campus",
    issueDate: "2025-05-10",
    dueDate: "2025-05-24",
    status: "sent",
    items: [
      { description: "Tuition Fee – Term 2", amount: 55000 },
      { description: "Graduation Fee", amount: 5000 },
      { description: "Lab Fee", amount: 3500 },
    ],
    total: 63500,
    paidAmount: 0,
  },
  {
    id: "7",
    number: "INV-2025-007",
    studentName: "Mariam Diallo",
    studentId: "STU-0088",
    class: "Nursery",
    campus: "Branch A",
    issueDate: "2025-04-15",
    dueDate: "2025-04-30",
    status: "overdue",
    items: [
      { description: "Tuition Fee – Term 2", amount: 28000 },
      { description: "Meals Fee", amount: 8000 },
    ],
    total: 36000,
    paidAmount: 0,
  },
  {
    id: "8",
    number: "INV-2025-008",
    studentName: "Yusuf Okafor",
    studentId: "STU-0411",
    class: "Grade 3",
    campus: "Main Campus",
    issueDate: "2025-05-12",
    dueDate: "2025-05-26",
    status: "draft",
    items: [{ description: "Tuition Fee – Term 2", amount: 38000 }],
    total: 38000,
    paidAmount: 0,
  },
];

export const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100" },
  sent: { label: "Sent", color: "text-blue-700", bg: "bg-blue-100" },
  paid: { label: "Paid", color: "text-green-700", bg: "bg-green-100" },
  overdue: { label: "Overdue", color: "text-red-700", bg: "bg-red-100" },
};

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
