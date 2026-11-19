import { z } from "zod";
import { json, parseQuery, withUser } from "@/lib/api";
import { RANGE_PRESETS, type RangePreset } from "@/lib/dates";
import { getAnalytics } from "@/server/data";

const ids = RANGE_PRESETS.map((p) => p.id) as [RangePreset, ...RangePreset[]];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z
  .object({ range: z.enum(ids).default("30d"), from: date.optional(), to: date.optional() })
  .refine((q) => q.range !== "custom" || (q.from && q.to), { message: "Choose a start and end date", path: ["from"] })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "Start date must be before end date", path: ["from"] })
  .refine(
    (q) => !q.from || !q.to || (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 366 * 3,
    { message: "Custom ranges can span up to 3 years", path: ["to"] },
  );

export const GET = withUser(async (req, { user }) => {
  const q = parseQuery(req, querySchema);
  return json(await getAnalytics(user.id, q.range, { from: q.from, to: q.to }));
});
