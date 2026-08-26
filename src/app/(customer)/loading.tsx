export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
      <div className="h-12 animate-pulse rounded-xl bg-stone-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-stone-200 bg-white p-2.5">
            <div className="aspect-square animate-pulse rounded-lg bg-stone-200" />
            <div className="h-4 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
            <div className="h-9 animate-pulse rounded-lg bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
