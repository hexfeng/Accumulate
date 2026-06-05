import { AppShell } from "@/components/app-shell";
import { AccountsView } from "@/components/accounts-view";
import { getAccounts, getSimpleFinStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, simpleFinStatus] = await Promise.all([getAccounts(), getSimpleFinStatus()]);

  return (
    <AppShell>
      <AccountsView initialAccounts={accounts} initialSimpleFinStatus={simpleFinStatus} />
    </AppShell>
  );
}
