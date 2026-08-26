import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/data";
import type { CatalogSort } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_SORTS = new Set(["newest", "price_asc", "price_desc", "popularity"]);
const VALID_FILTERS = new Set(["low_stock", "in_stock"]);

/** Paged catalog search for the client-side "Load more". */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const sortRaw = url.searchParams.get("sort") ?? "newest";
  const filterRaw = url.searchParams.get("filter") ?? "";
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);

  try {
    const result = await searchCatalog({
      query: q?.slice(0, 100),
      category: category?.slice(0, 100),
      sort: (VALID_SORTS.has(sortRaw) ? sortRaw : "newest") as CatalogSort,
      filter: VALID_FILTERS.has(filterRaw)
        ? (filterRaw as "low_stock" | "in_stock")
        : undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: 24,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("catalog search failed:", e);
    return NextResponse.json(
      { message: "Could not load products." },
      { status: 500 }
    );
  }
}
