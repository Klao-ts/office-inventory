import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Factory, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mimetta-logo.svg" alt="Mimetta" className="mb-6 h-10 w-auto" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Office Supplies</h1>
        <p className="mt-2 text-slate-500">Choose your branch to sign in.</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link href="/b/office">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="items-center text-center">
              <Building2 className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">Office</CardTitle>
              <CardDescription>Sign in to the Office branch</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/b/factory">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="items-center text-center">
              <Factory className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">Factory</CardTitle>
              <CardDescription>Sign in to the Factory branch</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Link href="/login" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ShieldCheck className="h-4 w-4" />
        Admin sign in
      </Link>
    </main>
  );
}