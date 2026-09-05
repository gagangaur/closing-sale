import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl">🏷️</p>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-sm text-stone-500">
        That page doesn&apos;t exist — but the closing sale does.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
      >
        Browse the sale
      </Link>
    </main>
  );
}
