import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { getCategoriesForAdmin } from "@/lib/admin-data";

export const metadata = { title: "New Product — Admin", robots: { index: false } };

export default async function NewProductPage() {
  const categories = await getCategoriesForAdmin();
  return (
    <div className="space-y-4">
      <nav className="text-sm text-stone-500">
        <Link href="/admin/products" className="hover:text-stone-900">
          ← Products
        </Link>
      </nav>
      <h1 className="text-xl font-bold">New product</h1>
      <ProductForm categories={categories} initial={null} />
    </div>
  );
}
