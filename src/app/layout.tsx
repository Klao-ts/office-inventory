import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Office Supplies Inventory",
  description: "Office supplies inventory and withdrawal system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
