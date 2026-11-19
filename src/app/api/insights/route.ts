import { json, withUser } from "@/lib/api";
import { getInsightsAndHealth } from "@/server/data";

export const GET = withUser(async (_req, { user }) => {
  return json(await getInsightsAndHealth(user.id));
});
