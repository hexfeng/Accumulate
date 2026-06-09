import { AppShell } from "@/components/app-shell";
import { SpendingView } from "@/components/spending-view";
import { getDashboard, getMonthlySpending, getTransactions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SpendingPage() {
  const [dashboard, summary, transactions] = await Promise.all([getDashboard(), getMonthlySpending(), getTransactions()]);

  return (
    <AppShell>
      <SpendingView accounts={dashboard.accounts} recurringItems={dashboard.recurring_items} summary={summary} transactions={transactions} />
    </AppShell>
  );
}

