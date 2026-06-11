import { AppShell } from "@/components/app-shell";
import { InvestmentsView } from "@/components/investments-view";
import { getAccounts, getHoldings, getPortfolio } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [accounts, holdings, portfolio] = await Promise.all([getAccounts(), getHoldings(), getPortfolio()]);

  return (
    <AppShell>
      <InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} />
    </AppShell>
  );
}
