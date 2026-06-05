import { AppShell } from "@/components/app-shell";
import { AccountsView } from "@/components/accounts-view";
import { getAccounts, getSimpleFinStatus, getTransactions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, simpleFinStatus, transactions] = await Promise.all([getAccounts(), getSimpleFinStatus(), getTransactions()]);

  return (
    <AppShell>
      <AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} initialTransactions={transactions} />
    </AppShell>
  );
}
