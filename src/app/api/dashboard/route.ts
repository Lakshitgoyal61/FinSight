import { json, withUser } from "@/lib/api";
import { getDashboard, getPreferences } from "@/server/data";

export const GET = withUser(async (_req, { user }) => {
  const [dashboard, preferences] = await Promise.all([getDashboard(user.id), getPreferences(user.id)]);
  return json({ ...dashboard, currency: preferences.currency });
});
