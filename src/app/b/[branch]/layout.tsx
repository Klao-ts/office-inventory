import Link from "next/link";
import { notFound } from "next/navigation";
import { isBranch, BRANCH_LABELS } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { BranchNav } from "@/components/branch/branch-nav";
import { BranchSignOut } from "@/components/branch/branch-sign-out";

export const dynamic = "force-dynamic";

export default async function BranchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { branch: string };
}) {
  const branch = params.branch;
  if (!isBranch(branch)) return notFound();

  const label = BRANCH_LABELS[branch];
  const { member } = await getCurrentStaff(branch);
  const approved = hasAccess(member);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href={`/b/${branch}`} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mimetta-logo.svg" alt="Mimetta" className="h-6 w-auto" />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {label}
              </span>
            </Link>
            {approved && <BranchNav branch={branch} variant="top" />}
          </div>
          {approved && (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="hidden max-w-[10rem] truncate md:inline">{member?.full_name}</span>
              <BranchSignOut />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:pb-8">{children}</main>

      {approved && <BranchNav branch={branch} variant="bottom" />}
    </div>
  );
}