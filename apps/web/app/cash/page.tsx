import { AppShell } from "@/components/app-shell";
import { PlaceholderView } from "@/components/placeholder-view";

export default function CashPage() {
  return (
    <AppShell>
      <PlaceholderView
        description="Mock cash workspace placeholder. The Dashboard already previews the 30/60/90 day forecast while the dedicated cash planning view is being built."
        eyebrow="Mock workspace"
        title="Cash"
      />
    </AppShell>
  );
}
