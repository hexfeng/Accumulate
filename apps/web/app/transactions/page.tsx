import { AppShell } from "@/components/app-shell";
import { TransactionsView } from "@/components/transactions-view";
import { getTransactions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <AppShell>
      <TransactionsView initialTransactions={transactions} />
    </AppShell>
  );
}

