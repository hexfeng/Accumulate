import { AppShell } from "@/components/app-shell";
import { CashView } from "@/components/cash-view";
import { getAccounts, getCashflowForecast, getDashboard, getTransactions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const [accounts, forecast, dashboard, transactions] = await Promise.all([getAccounts(), getCashflowForecast(), getDashboard(), getTransactions()]);

  return (
    <AppShell>
      <CashView accounts={accounts} forecast={forecast} monthlySummary={dashboard.monthly_summary} transactions={transactions} />
    </AppShell>
  );
}
