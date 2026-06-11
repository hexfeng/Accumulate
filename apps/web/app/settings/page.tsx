import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings-view";
import { getSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <AppShell>
      <SettingsView initialSettings={settings} />
    </AppShell>
  );
}
