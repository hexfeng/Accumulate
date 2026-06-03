import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboard, getNetWorthHistory } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [snapshot, initialNetWorthHistory] = await Promise.all([getDashboard(), getNetWorthHistory("1M")]);

  return (
    <AppShell>
      <DashboardView initialNetWorthHistory={initialNetWorthHistory} snapshot={snapshot} />
    </AppShell>
  );
}
