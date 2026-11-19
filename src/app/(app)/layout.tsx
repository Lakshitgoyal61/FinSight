import { requireUser } from "@/lib/auth/session";
import { getPreferences } from "@/server/data";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const prefs = await getPreferences(user.id);
  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, isDemo: user.isDemo, createdAt: user.createdAt.toISOString() }}
      currency={prefs.currency}
      theme={prefs.theme}
    >
      {children}
    </AppShell>
  );
}
