"use client";

import { useEffect, useState } from "react";
import { Home, Briefcase, MapPin, Plus, Loader2 } from "lucide-react";
import {
  deleteAddress,
  fetchAddresses,
  type SavedAddress,
} from "@/lib/api/addresses";
import { AddressFormSheet } from "./address-form-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type State =
  | { kind: "loading" }
  | { kind: "ready"; addresses: SavedAddress[] }
  | { kind: "error"; message: string };

/**
 * /addresses — list + add + edit + delete saved customer addresses.
 *
 * Backend has no "set default" endpoint, so the UI surfaces the
 * is_default flag (when the row carries one) but doesn't expose a
 * way to flip it. v1 of address-book CRUD only.
 */
export function AddressBook() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function refresh() {
    setState({ kind: "loading" });
    const res = await fetchAddresses();
    setState(
      res.ok
        ? { kind: "ready", addresses: res.addresses }
        : { kind: "error", message: res.message },
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  async function performDelete(id: number) {
    setConfirmDeleteId(null);
    setDeleting(id);
    const res = await deleteAddress(id);
    setDeleting(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Address removed.");
    refresh();
  }

  return (
    <>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full bg-brand-red px-5 text-sm font-medium text-white shadow-sm transition-colors",
            "hover:bg-brand-red-600 active:bg-brand-red-700",
          )}
        >
          <Plus size={16} />
          Add new address
        </button>
      </div>

      {state.kind === "loading" && (
        <CenterSpinner label="Loading addresses…" />
      )}

      {state.kind === "error" && (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && state.addresses.length === 0 && (
        <EmptyState onAdd={() => setCreating(true)} />
      )}

      {state.kind === "ready" && state.addresses.length > 0 && (
        <ul className="space-y-3">
          {state.addresses.map((a) => (
            <li key={a.id}>
              <AddressCard
                address={a}
                deleting={deleting === a.id}
                onEdit={() => setEditing(a)}
                onDelete={() => setConfirmDeleteId(a.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <AddressFormSheet
        open={creating || !!editing}
        existing={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          setEditing(null);
          setCreating(false);
          refresh();
          toast.success("Address saved.");
        }}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Remove this address?"
        body="You'll need to add it again from scratch if you change your mind."
        confirmLabel="Remove"
        cancelLabel="Keep it"
        tone="danger"
        busy={deleting === confirmDeleteId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId !== null) performDelete(confirmDeleteId);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------- */

function AddressCard({
  address,
  deleting,
  onEdit,
  onDelete,
}: {
  address: SavedAddress;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = iconForType(address.address_type);
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink-900">
              {address.address_type}
            </p>
            {address.is_default ? (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-600">
                Default
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-700">{address.address}</p>
          {(address.floor || address.road || address.house) && (
            <p className="mt-1 text-xs text-ink-500">
              {[address.house, address.road, address.floor]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {address.contact_person_number && (
            <p className="mt-2 text-xs text-ink-500">
              {address.contact_person_name} ·{" "}
              {address.contact_person_number}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-ink-200/70 pt-3 text-sm">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full px-3 py-1.5 text-ink-700 hover:bg-ink-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-full px-3 py-1.5 text-error hover:bg-error/5 disabled:opacity-50"
        >
          {deleting ? "Removing…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <MapPin size={20} />
      </div>
      <h2 className="mt-4 font-serif text-xl text-ink-900">
        No saved addresses yet
      </h2>
      <p className="mt-2 text-sm text-ink-600">
        Save the places you order to most — home, office, the gym — and
        checkout takes seconds.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-red-600"
      >
        <Plus size={16} />
        Add your first address
      </button>
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[20vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

function iconForType(type: string) {
  const norm = (type ?? "").toLowerCase();
  if (norm.includes("home")) return Home;
  if (norm.includes("office") || norm.includes("work")) return Briefcase;
  return MapPin;
}
