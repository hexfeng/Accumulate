import { AppShell } from "@/components/app-shell";
import { PlaceholderView } from "@/components/placeholder-view";

export default function InvestmentsPage() {
  return (
    <AppShell>
      <PlaceholderView
        description="Mock investments workspace placeholder. Allocation and return views use demo data until holdings are connected."
        eyebrow="Mock workspace"
        title="Investments"
      />
    </AppShell>
  );
}
