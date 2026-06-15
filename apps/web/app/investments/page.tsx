import { AppShell } from "@/components/app-shell";
import { InvestmentsView } from "@/components/investments-view";
import { getAccounts, getHoldings, getPortfolio, getWatchlist } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [accounts, holdings, portfolio, watchlist] = await Promise.all([getAccounts(), getHoldings(), getPortfolio(), getWatchlist()]);

  return (
    <AppShell>
      <InvestmentsView accounts={accounts} initialHoldings={holdings} initialPortfolio={portfolio} initialWatchlist={watchlist} />
    </AppShell>
  );
}
