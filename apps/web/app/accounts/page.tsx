import { AppShell } from "@/components/app-shell";
import { PlaceholderView } from "@/components/placeholder-view";

export default function AccountsPage() {
  return (
    <AppShell>
      <PlaceholderView
        description="Mock account setup placeholder. This will become the connection and data health area for manual accounts and SimpleFIN imports."
        eyebrow="Mock setup"
        primaryActionLabel="Return to dashboard"
        title="Accounts"
      />
    </AppShell>
  );
}
