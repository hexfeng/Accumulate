import { AppShell } from "@/components/app-shell";
import { PlaceholderView } from "@/components/placeholder-view";

export default function RecapPage() {
  return (
    <AppShell>
      <PlaceholderView
        description="Mock recap placeholder. Monthly summary cards on the Dashboard stay available while the full recap page is prepared."
        eyebrow="Mock workspace"
        title="Recap"
      />
    </AppShell>
  );
}
