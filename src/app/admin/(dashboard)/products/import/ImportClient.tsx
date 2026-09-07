"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  bulkImportProducts,
  type ImportReport,
  type ImportRow,
} from "@/app/admin/(dashboard)/actions";
import { detectDelimiter, parseCsv, toCsv } from "@/lib/csv";

const TEMPLATE_HEADER = [
  "name",
  "description",
  "category",
  "tags",
  "mrp",
  "selling_price",
  "quantity",
  "active",
];

const TEMPLATE_EXAMPLE = [
  "Steel Water Bottle 1L",
  "Insulated, leak-proof cap",
  "Kitchen & Dining",
  "bottle|steel|water",
  "499",
  "249",
  "50",
  "true",
];

// header aliases -> canonical field
const HEADER_MAP: Record<string, keyof ImportRow> = {
  name: "name",
  "product name": "name",
  product: "name",
  description: "description",
  category: "category",
  tags: "tags", // cell is split into an array when building rows
  mrp: "mrp",
  "selling price": "selling_price",
  selling_price: "selling_price",
  price: "selling_price",
  quantity: "quantity",
  qty: "quantity",
  stock: "quantity",
  active: "active",
  "active status": "active",
  status: "active",
};

export function ImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function downloadTemplate() {
    const csv = toCsv([TEMPLATE_HEADER, TEMPLATE_EXAMPLE]);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "product-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(file: File | null) {
    setParseError(null);
    setReport(null);
    setDone(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);

    // Accept comma, tab (Excel "Text (Tab delimited)") or semicolon files,
    // with or without a BOM.
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const parsed = parseCsv(text, detectDelimiter(text));
    if (parsed.length < 2) {
      setParseError("The file needs a header row and at least one data row.");
      return;
    }

    const header = parsed[0].map((h) => h.trim().toLowerCase());
    const colFor: Partial<Record<string, number>> = {};
    header.forEach((h, i) => {
      const key = HEADER_MAP[h];
      if (key && colFor[key] === undefined) colFor[key] = i;
    });
    if (colFor.name === undefined || colFor.mrp === undefined ||
        colFor.selling_price === undefined || colFor.quantity === undefined) {
      setParseError(
        'The file must have at least these columns: "name", "mrp", "selling_price", "quantity" (comma, tab or semicolon separated). Download the template to see the format.'
      );
      return;
    }

    const dataRows: ImportRow[] = parsed.slice(1).map((cells) => {
      const get = (key: string) => {
        const idx = colFor[key];
        return idx === undefined ? "" : (cells[idx] ?? "").trim();
      };
      return {
        name: get("name"),
        description: get("description"),
        category: get("category"),
        tags: get("tags")
          .split(/[|,;]/)
          .map((t) => t.trim())
          .filter(Boolean),
        mrp: get("mrp"),
        selling_price: get("selling_price"),
        quantity: get("quantity"),
        active: get("active") || "true",
      };
    });

    if (dataRows.length > 2000) {
      setParseError("Maximum 2000 rows per import. Split the file and try again.");
      return;
    }

    setRows(dataRows);
    // validate on the server (dry run) immediately
    startTransition(async () => {
      const result = await bulkImportProducts(dataRows, true);
      setReport(result);
    });
  }

  function confirmImport() {
    if (!rows) return;
    startTransition(async () => {
      const result = await bulkImportProducts(rows, false);
      if (result.ok && !result.dry_run) {
        setDone(result.imported ?? rows.length);
        setRows(null);
        setReport(null);
        router.refresh();
      } else {
        setReport(result);
      }
    });
  }

  const errorsByRow = new Map<number, string[]>();
  if (report && !report.ok) {
    for (const e of report.errors) errorsByRow.set(e.row, e.errors);
  }
  // names repeated inside the file are allowed but usually a mistake
  const nameCounts = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = r.name.trim().toLowerCase();
    if (k) nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          1 · Prepare your file
        </h2>
        <p className="mt-1 text-stone-600">
          Columns: <code className="rounded bg-stone-100 px-1">name</code>,{" "}
          <code className="rounded bg-stone-100 px-1">description</code>,{" "}
          <code className="rounded bg-stone-100 px-1">category</code>,{" "}
          <code className="rounded bg-stone-100 px-1">tags</code> (separated by | or ,),{" "}
          <code className="rounded bg-stone-100 px-1">mrp</code>,{" "}
          <code className="rounded bg-stone-100 px-1">selling_price</code>,{" "}
          <code className="rounded bg-stone-100 px-1">quantity</code>,{" "}
          <code className="rounded bg-stone-100 px-1">active</code> (true/false). New
          category names are created automatically.
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Images cannot be imported via CSV — upload them on each product&apos;s edit
          page after importing.
        </p>
        <button
          onClick={downloadTemplate}
          className="mt-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold"
        >
          Download template CSV
        </button>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          2 · Upload &amp; validate
        </h2>
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        {parseError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {parseError}
          </p>
        )}
      </section>

      {done !== null && (
        <div className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
          ✅ Imported {done} products successfully.{" "}
          <Link href="/admin/products" className="underline">
            View products →
          </Link>
        </div>
      )}

      {rows && (
        <section className="rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
              3 · Preview — {fileName} ({rows.length} rows)
            </h2>
            {pending ? (
              <span className="text-sm text-stone-500">Validating…</span>
            ) : report?.ok ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                All rows valid ✓
              </span>
            ) : report ? (
              <span className="rounded bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
                {errorsByRow.size} row(s) with errors — fix the file and re-upload
              </span>
            ) : null}
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-150 text-xs">
              <thead className="sticky top-0 bg-stone-50">
                <tr className="text-left uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">MRP</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r, i) => {
                  const errs = errorsByRow.get(i + 1) ?? [];
                  return (
                    <tr key={i} className={errs.length ? "bg-danger-soft/60" : ""}>
                      <td className="px-3 py-1.5 text-stone-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{r.name || "—"}</td>
                      <td className="px-3 py-1.5">{r.category || "—"}</td>
                      <td className="px-3 py-1.5 text-right">{r.mrp}</td>
                      <td className="px-3 py-1.5 text-right">{r.selling_price}</td>
                      <td className="px-3 py-1.5 text-right">{r.quantity}</td>
                      <td className="px-3 py-1.5 font-semibold text-danger">
                        {errs.join(" ")}
                        {errs.length === 0 &&
                          (nameCounts.get(r.name.trim().toLowerCase()) ?? 0) > 1 && (
                            <span className="font-medium text-deal">
                              ⚠ Same name appears more than once in this file
                            </span>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-stone-200 px-4 py-3">
            <button
              onClick={confirmImport}
              disabled={pending || !report?.ok}
              className="h-11 rounded-xl bg-stone-900 px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending
                ? "Working…"
                : `Confirm import of ${rows.length} products`}
            </button>
            <p className="mt-1 text-xs text-stone-400">
              Import is all-or-nothing: if anything fails, no products are created.
              Initial quantities are recorded in the inventory audit log.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
