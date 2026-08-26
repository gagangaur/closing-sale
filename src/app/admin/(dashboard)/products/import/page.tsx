import Link from "next/link";
import { ImportClient } from "./ImportClient";

export const metadata = { title: "Import Products — Admin", robots: { index: false } };

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <nav className="text-sm text-stone-500">
        <Link href="/admin/products" className="hover:text-stone-900">
          ← Products
        </Link>
      </nav>
      <h1 className="text-xl font-bold">Bulk product import (CSV)</h1>
      <ImportClient />
    </div>
  );
}
