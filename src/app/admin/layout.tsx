import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Package } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const service = createServiceClient();
  const { count: pendingCount } = await service
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold text-slate-900">
              <Package className="h-5 w-5 text-primary" />
              Inventory Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/admin" className="hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/admin/staff" className="flex items-center hover:text-slate-900">
                Staff
                {pendingCount ? (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
              <Link href="/admin/notifications" className="hover:text-slate-900">
                Notifications
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{user?.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}