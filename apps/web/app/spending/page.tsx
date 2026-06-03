import { AppShell } from "@/components/app-shell";
import { SpendingView } from "@/components/spending-view";
import { getMonthlySpending } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const summary = await getMonthlySpending();

  return (
    <AppShell>
      <SpendingView summary={summary} />
    </AppShell>
  );
}

