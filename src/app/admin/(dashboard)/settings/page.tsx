import { SettingsForm } from "@/components/admin/SettingsForm";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Settings — Admin", robots: { index: false } };

export default async function SettingsPage() {
  const supabase = await authServerClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const initial = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Shop settings</h1>
      <p className="text-sm text-stone-500">
        Everything here is live business configuration — nothing is hard-coded in the
        app.
      </p>
      <SettingsForm initial={initial} />
    </div>
  );
}
