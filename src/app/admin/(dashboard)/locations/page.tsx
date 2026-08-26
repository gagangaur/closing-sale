import { LocationEditor, type AdminLocation } from "@/components/admin/LocationEditor";
import { authServerClient } from "@/lib/supabase/server-auth";

export const metadata = { title: "Locations — Admin", robots: { index: false } };

export default async function LocationsPage() {
  const supabase = await authServerClient();
  const { data } = await supabase
    .from("locations")
    .select(
      "id, name, area, description, status, notes, archived, sort_order, collection_slots (id, slot_date, start_time, end_time, active, notes)"
    )
    .order("sort_order")
    .order("slot_date", { referencedTable: "collection_slots", ascending: true });

  const locations: AdminLocation[] = ((data ?? []) as unknown as Array<
    Omit<AdminLocation, "slots"> & { collection_slots: AdminLocation["slots"] }
  >).map((l) => ({
    ...l,
    slots: l.collection_slots ?? [],
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Collection locations</h1>
      <p className="max-w-2xl text-sm text-stone-500">
        <strong>Confirmed</strong> locations (with date/time slots) are selectable at
        checkout. <strong>Coming soon</strong> locations are shown to customers with
        “schedule to be announced” — never fake dates. <strong>Disabled</strong>{" "}
        locations are hidden.
      </p>
      <LocationEditor locations={locations} />
    </div>
  );
}
