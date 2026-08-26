// Indian Rupee formatting. Prices are numbers with at most 2 decimals;
// all money math that matters happens in the database.

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹22.50 for fractional values, ₹500 for whole values. */
export function formatINR(value: number): string {
  return Number.isInteger(value) ? inrWhole.format(value) : inrPaise.format(value);
}

/** "10% OFF" — trims trailing zeros (10.00 -> 10, 12.50 -> 12.5). */
export function formatDiscount(pct: number): string {
  const trimmed = Number.parseFloat(pct.toFixed(2));
  return `${trimmed}% OFF`;
}

/** 2026-08-29 -> "Fri, 29 Aug 2026" */
export function formatSlotDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "17:00:00" -> "5:00 PM" */
export function formatSlotTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
