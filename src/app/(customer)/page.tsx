import { Suspense } from "react";
import { CatalogGrid } from "@/components/customer/CatalogGrid";
import { SaleBanner } from "@/components/customer/SaleBanner";
import { SearchControls } from "@/components/customer/SearchControls";
import { SectionRow } from "@/components/customer/SectionRow";
import {
  getCategories,
  getOfferTiers,
  getPublicSettings,
  searchCatalog,
} from "@/lib/data";
import type { CatalogSort } from "@/lib/types";

const VALID_SORTS: CatalogSort[] = ["newest", "price_asc", "price_desc", "popularity"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "newest";
  const sort: CatalogSort = VALID_SORTS.includes(sortParam as CatalogSort)
    ? (sortParam as CatalogSort)
    : "newest";
  const isFiltered = Boolean(query || category || sort !== "newest");

  const [settings, categories, tiers, catalog, popular, almostGone] =
    await Promise.all([
      getPublicSettings(),
      getCategories(),
      getOfferTiers(),
      searchCatalog({ query, category, sort, pageSize: 24 }),
      isFiltered
        ? Promise.resolve(null)
        : searchCatalog({ sort: "popularity", filter: "in_stock", pageSize: 8 }),
      isFiltered
        ? Promise.resolve(null)
        : searchCatalog({ filter: "low_stock", pageSize: 8 }),
    ]);

  const popularItems = (popular?.items ?? []).filter((p) => p.units_ordered > 0);

  return (
    <div className="space-y-6">
      {!isFiltered && <SaleBanner settings={settings} tiers={tiers} />}

      <Suspense fallback={null}>
        <SearchControls categories={categories} />
      </Suspense>

      {!isFiltered && (
        <>
          <SectionRow
            title="🔥 Almost Gone"
            subtitle="Low stock — grab them now"
            products={almostGone?.items ?? []}
            threshold={catalog.low_stock_threshold}
            accent
          />
          <SectionRow
            title="⭐ Popular Picks"
            subtitle="Best sellers from real orders"
            products={popularItems}
            threshold={catalog.low_stock_threshold}
          />
        </>
      )}

      <section aria-label="All products">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">
            {isFiltered ? "Results" : "All Products"}
          </h2>
          <span className="text-xs text-stone-500">
            {catalog.total} item{catalog.total === 1 ? "" : "s"}
          </span>
        </div>
        <CatalogGrid
          key={`${query}|${category}|${sort}`}
          initial={catalog}
          query={query}
          category={category}
          sort={sort}
        />
      </section>
    </div>
  );
}
