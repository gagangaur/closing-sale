import type { ReactNode } from "react";
import { Footer } from "@/components/customer/Footer";
import { Header } from "@/components/customer/Header";
import { getPublicSettings } from "@/lib/data";

// Catalog, stock and settings must always be fresh — never build-time snapshots.
export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  return (
    <>
      <Header shopName={settings.shop_name} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
