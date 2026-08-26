import type { Metadata } from "next";
import { BucketClient } from "@/components/cart/BucketClient";
import { getLocations, getOfferTiers, getPublicSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Your Bucket" };

export default async function BucketPage() {
  const [settings, tiers, locations] = await Promise.all([
    getPublicSettings(),
    getOfferTiers(),
    getLocations(),
  ]);

  return <BucketClient settings={settings} tiers={tiers} locations={locations} />;
}
