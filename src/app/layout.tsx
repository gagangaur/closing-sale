import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Radha Krishna Book Depo — Closing Sale",
    template: "%s | Radha Krishna Book Depo",
  },
  description:
    "Radha Krishna Book Depo, Mathura, is closing after 28 years. Heavy Discount SALE on limited stock — only on Saturday & Sunday. Reserve online, collect and pay at pickup. No home delivery, no online payment.",
  applicationName: "Radha Krishna Book Depo",
  openGraph: {
    title: "Radha Krishna Book Depo — Closing Sale · Heavy Discount SALE",
    description:
      "After 28 years, Radha Krishna Book Depo is closing its doors. Heavy discounts, limited stock — only on Saturday & Sunday. Reserve online, collect & pay at pickup.",
    siteName: "Radha Krishna Book Depo",
    locale: "en_IN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
