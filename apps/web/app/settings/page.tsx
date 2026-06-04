import { AppShell } from "@/components/app-shell";
import { PlaceholderView } from "@/components/placeholder-view";

export default function SettingsPage() {
  return (
    <AppShell>
      <PlaceholderView
        description="Mock settings placeholder. Goal configuration and product preferences will live here once those flows are ready."
        eyebrow="Mock setup"
        title="Settings"
      />
    </AppShell>
  );
}
