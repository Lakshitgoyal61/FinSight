import { db } from "@/lib/db";
import { ApiError, json, withUser } from "@/lib/api";
import { parseTransactionsCsv } from "@/lib/csv";
import { dateFromKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";

const MAX_CHARS = 1_000_000;

/**
 * Accepts { csv: string, dryRun?: boolean }. A dry run validates and returns a preview
 * without writing anything, so the UI can show row-level errors before the user commits.
 */
export const POST = withUser(async (req, { user }) => {
  const body = (await req.json().catch(() => null)) as { csv?: unknown; dryRun?: unknown } | null;
  if (!body || typeof body.csv !== "string") throw new ApiError(400, "Upload a CSV file to import");
  if (body.csv.length > MAX_CHARS) throw new ApiError(413, "The file is too large (max 1 MB)");
  if (!body.csv.trim()) throw new ApiError(422, "The file is empty");

  const result = parseTransactionsCsv(body.csv);
  if (body.dryRun) {
    return json({
      totalRows: result.totalRows,
      validCount: result.valid.length,
      errors: result.errors.slice(0, 50),
      errorCount: result.errors.length,
      preview: result.valid.slice(0, 5),
    });
  }
  if (!result.valid.length) {
    throw new ApiError(422, result.errors[0]?.message ?? "No valid rows found in the file");
  }
  await db.transaction.createMany({
    data: result.valid.map((t) => ({
      userId: user.id,
      title: t.title,
      amount: toMinor(t.amount),
      type: t.type,
      category: t.category,
      date: dateFromKey(t.date),
      paymentMethod: t.paymentMethod,
      description: t.description,
    })),
  });
  return json({ imported: result.valid.length, skipped: result.errors.length, errors: result.errors.slice(0, 50) });
});
