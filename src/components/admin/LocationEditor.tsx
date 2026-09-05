"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteSlot,
  saveLocation,
  saveSlot,
  setLocationArchived,
  type LocationInput,
  type SlotInput,
} from "@/app/admin/(dashboard)/actions";
import { formatSlotDate, formatSlotTime } from "@/lib/format";

export type AdminSlot = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  active: boolean;
  notes: string;
};

export type AdminLocation = {
  id: string;
  name: string;
  area: string;
  description: string;
  status: "confirmed" | "coming_soon" | "disabled";
  notes: string;
  archived: boolean;
  sort_order: number;
  slots: AdminSlot[];
};

const inputCls =
  "h-10 w-full rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20";

const STATUS_BADGE: Record<AdminLocation["status"], { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700" },
  coming_soon: { label: "Coming soon", cls: "bg-deal-soft text-deal" },
  disabled: { label: "Disabled", cls: "bg-stone-200 text-stone-600" },
};

function LocationForm({
  initial,
  onDone,
}: {
  initial: AdminLocation | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<LocationInput>({
    id: initial?.id,
    name: initial?.name ?? "",
    area: initial?.area ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "coming_soon",
    notes: initial?.notes ?? "",
    sort_order: initial?.sort_order ?? 0,
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveLocation(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-300 bg-stone-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Location name</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Green Valley Society Gate 2"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Society / area</span>
          <input
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            placeholder="e.g. Krishna Nagar, Mathura"
            className={inputCls}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Description / instructions</span>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Collection table near the security cabin"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Status</span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as LocationInput["status"] })
            }
            className={inputCls}
          >
            <option value="confirmed">Confirmed — customers can select it</option>
            <option value="coming_soon">Coming soon — visible, not selectable</option>
            <option value="disabled">Disabled — hidden from customers</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Additional notes</span>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="h-10 rounded-lg bg-stone-900 px-5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save location" : "Create location"}
        </button>
        <button onClick={onDone} className="h-10 rounded-lg border border-stone-300 px-4 text-sm font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}

function SlotRowForm({
  locationId,
  onDone,
}: {
  locationId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SlotInput>({
    location_id: locationId,
    slot_date: "",
    start_time: "17:00",
    end_time: "20:00",
    active: true,
    notes: "",
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveSlot(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-stone-300 bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="date"
          value={form.slot_date}
          onChange={(e) => setForm({ ...form, slot_date: e.target.value })}
          className="h-9 rounded-lg border border-stone-300 px-2 text-sm"
        />
        <input
          type="time"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          className="h-9 rounded-lg border border-stone-300 px-2 text-sm"
        />
        –
        <input
          type="time"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          className="h-9 rounded-lg border border-stone-300 px-2 text-sm"
        />
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes (optional)"
          className="h-9 min-w-32 flex-1 rounded-lg border border-stone-300 px-2 text-sm"
        />
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="h-9 rounded-lg bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-60"
        >
          Add slot
        </button>
        <button onClick={onDone} className="h-9 rounded-lg border border-stone-300 px-3 text-xs font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LocationEditor({ locations }: { locations: AdminLocation[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [addingSlotFor, setAddingSlotFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggleArchive(loc: AdminLocation) {
    const archiving = !loc.archived;
    if (archiving && !window.confirm("Archive this location? Customers will no longer see it."))
      return;
    startTransition(async () => {
      await setLocationArchived(loc.id, archiving);
      router.refresh();
    });
  }

  function removeSlot(id: string) {
    if (!window.confirm("Delete this collection slot?")) return;
    startTransition(async () => {
      await deleteSlot(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {editing === "new" ? (
        <LocationForm initial={null} onDone={() => setEditing(null)} />
      ) : (
        <button
          onClick={() => setEditing("new")}
          className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          + New location
        </button>
      )}

      {locations.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No collection locations yet.
        </p>
      )}

      <ul className="space-y-2">
        {locations.map((loc) =>
          editing === loc.id ? (
            <li key={loc.id}>
              <LocationForm initial={loc} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={loc.id}
              className={`rounded-xl border border-stone-200 bg-white p-3 ${loc.archived ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {loc.name}
                    {loc.area && <span className="font-normal text-stone-500"> · {loc.area}</span>}
                  </p>
                  {loc.description && (
                    <p className="text-xs text-stone-500">{loc.description}</p>
                  )}
                </div>
                {loc.archived ? (
                  <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
                    Archived
                  </span>
                ) : (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[loc.status].cls}`}
                  >
                    {STATUS_BADGE[loc.status].label}
                  </span>
                )}
                <div className="flex gap-2">
                  {!loc.archived && (
                    <button
                      onClick={() => setEditing(loc.id)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => toggleArchive(loc)}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600"
                  >
                    {loc.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>

              {/* slots */}
              {!loc.archived && (
                <div className="mt-2 border-t border-stone-100 pt-2">
                  {loc.slots.length === 0 && loc.status === "confirmed" && (
                    <p className="text-xs text-deal">
                      ⚠ No collection date/time yet — customers will see the location
                      without a schedule.
                    </p>
                  )}
                  <ul className="space-y-1">
                    {loc.slots.map((slot) => (
                      <li
                        key={slot.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          📅 {formatSlotDate(slot.slot_date)} ·{" "}
                          {formatSlotTime(slot.start_time)} – {formatSlotTime(slot.end_time)}
                          {slot.notes && (
                            <span className="text-xs text-stone-400"> · {slot.notes}</span>
                          )}
                        </span>
                        <button
                          onClick={() => removeSlot(slot.id)}
                          className="text-xs text-stone-400 underline"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                  {addingSlotFor === loc.id ? (
                    <SlotRowForm locationId={loc.id} onDone={() => setAddingSlotFor(null)} />
                  ) : (
                    <button
                      onClick={() => setAddingSlotFor(loc.id)}
                      className="mt-1 text-xs font-semibold text-stone-600 underline"
                    >
                      + Add date/time slot
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        )}
      </ul>
    </div>
  );
}
