import Link from "next/link";
import { QrGeneratorCard } from "@/components/qr-generator";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, ShieldCheck } from "lucide-react";

export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const withdrawUrl = `${appUrl}/withdraw`;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Office Supplies Inventory</h1>
        <p className="mt-2 text-slate-500">Scan the QR code or tap below to request supplies.</p>
      </div>

      <QrGeneratorCard url={withdrawUrl} />

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link href="/withdraw">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="items-center text-center">
              <ClipboardList className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">Request Item</CardTitle>
              <CardDescription>Open the withdrawal form</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/login">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="items-center text-center">
              <ShieldCheck className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">Admin</CardTitle>
              <CardDescription>Manage inventory</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
  );
}