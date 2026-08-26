import type { Metadata } from "next";
import { FindOrderClient } from "./FindOrderClient";

export const metadata: Metadata = { title: "Find My Order", robots: { index: false } };

export default async function FindOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initial = typeof sp.order === "string" ? sp.order.slice(0, 30) : "";
  return <FindOrderClient initialOrderNumber={initial} />;
}
