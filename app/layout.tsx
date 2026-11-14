import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  title: "Dukaan Sathi AI - Kirana Smart Assistant",
  description: "Inventory, daily sales, and customer credit ledger for kirana stores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800 selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
