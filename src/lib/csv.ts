import Papa from "papaparse";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, getCategory } from "./constants";
import { transactionSchema, type TransactionInput } from "./validators";

export const CSV_HEADERS = ["date", "title", "amount", "type", "category", "payment_method", "description"] as const;
export const MAX_IMPORT_ROWS = 2000;

export type CsvRowError = { row: number; message: string };
export type CsvParseResult = { valid: TransactionInput[]; errors: CsvRowError[]; totalRows: number };

const ALIASES: Record<string, (typeof CSV_HEADERS)[number]> = {
  date: "date",
  "transaction date": "date",
  title: "title",
  merchant: "title",
  name: "title",
  payee: "title",
  amount: "amount",
  type: "type",
  category: "category",
  payment_method: "payment_method",
  "payment method": "payment_method",
  method: "payment_method",
  description: "description",
  notes: "description",
  note: "description",
};

function normalizeCategory(value: string, type: "INCOME" | "EXPENSE"): string {
  const v = value.trim().toLowerCase();
  const list = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const match = list.find((c) => c.id === v || c.label.toLowerCase() === v);
  if (match) return match.id;
  const loose = list.find((c) => c.label.toLowerCase().startsWith(v) || c.label.toLowerCase().includes(v));
  if (loose && v.length >= 3) return loose.id;
  return type === "INCOME" ? "other_income" : "other";
}

function normalizeDate(value: string): string {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // DD/MM/YYYY or DD-MM-YYYY (Indian format)
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return v;
}

function normalizePayment(value: string | undefined): string {
  if (!value) return "UPI";
  const v = value.trim().toLowerCase();
  return PAYMENT_METHODS.find((p) => p.toLowerCase() === v) ?? "UPI";
}

/** Parse and validate CSV text into transaction inputs with row-level error messages. */
export function parseTransactionsCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase(),
  });

  const errors: CsvRowError[] = [];
  const valid: TransactionInput[] = [];
  const fields = parsed.meta.fields ?? [];
  const missing = ["date", "title", "amount"].filter((f) => !fields.includes(f));
  if (missing.length) {
    return {
      valid,
      errors: [{ row: 1, message: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` }],
      totalRows: 0,
    };
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return { valid, errors: [{ row: 0, message: `Too many rows. The maximum per import is ${MAX_IMPORT_ROWS}.` }], totalRows: parsed.data.length };
  }

  parsed.data.forEach((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const amountRaw = String(raw.amount ?? "").replace(/[₹$€£,\s]/g, "");
    const amountNum = Number(amountRaw);
    let type: "INCOME" | "EXPENSE";
    const typeRaw = String(raw.type ?? "").trim().toLowerCase();
    if (typeRaw === "income" || typeRaw === "credit" || typeRaw === "cr") type = "INCOME";
    else if (typeRaw === "expense" || typeRaw === "debit" || typeRaw === "dr") type = "EXPENSE";
    else if (!typeRaw) type = "EXPENSE"; // no type column: treat as spending (sign is ignored)
    else {
      errors.push({ row: rowNumber, message: `Unknown type "${raw.type}". Use income or expense.` });
      return;
    }
    const candidate = {
      title: raw.title,
      amount: Number.isFinite(amountNum) ? Math.abs(amountNum) : amountRaw,
      type,
      category: normalizeCategory(String(raw.category ?? ""), type),
      date: normalizeDate(String(raw.date ?? "")),
      paymentMethod: normalizePayment(raw.payment_method),
      description: raw.description || null,
    };
    const result = transactionSchema.safeParse(candidate);
    if (!result.success) {
      const issue = result.error.issues[0]!;
      const field = issue.path[0] ? `${String(issue.path[0])}: ` : "";
      errors.push({ row: rowNumber, message: `${field}${issue.message}` });
    } else {
      valid.push(result.data);
    }
  });

  return { valid, errors, totalRows: parsed.data.length };
}

export type ExportableTransaction = {
  date: Date;
  title: string;
  amount: number; // major units
  type: string;
  category: string;
  paymentMethod: string;
  description: string | null;
};

/** Serialize transactions to CSV (re-importable by parseTransactionsCsv). */
export function transactionsToCsv(rows: ExportableTransaction[]): string {
  return Papa.unparse({
    fields: [...CSV_HEADERS],
    data: rows.map((r) => [
      r.date.toISOString().slice(0, 10),
      r.title,
      r.amount.toFixed(2),
      r.type.toLowerCase(),
      getCategory(r.category).label,
      r.paymentMethod,
      r.description ?? "",
    ]),
  });
}
