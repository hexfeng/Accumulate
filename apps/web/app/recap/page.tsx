import { AppShell } from "@/components/app-shell";
import { RecapView } from "@/components/recap-view";
import { getDashboard, getMonthlySpending, getTransactions } from "@/lib/api";

export const dynamic = "force-dynamic";

type RecapPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

export default async function RecapPage({ searchParams }: RecapPageProps) {
  const dashboard = await getDashboard();
  const params = await searchParams;
  const period = params?.period ?? dashboard.monthly_summary.month;
  const [summary, transactions] = await Promise.all([getMonthlySpending(period), getTransactions()]);

  return (
    <AppShell>
      <RecapView period={period} recurringItems={dashboard.recurring_items} summary={summary} transactions={transactions} />
    </AppShell>
  );
}
