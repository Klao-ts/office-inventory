"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PackageMinus } from "lucide-react";

export function BranchNav({ branch, variant }: { branch: string; variant: "top" | "bottom" }) {
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: `/b/${branch}`, label: "Home", Icon: Home, exact: true },
    { href: `/b/${branch}/withdraw`, label: "Withdraw", Icon: PackageMinus, exact: false },
  ];

  const isActive = (tab: (typeof tabs)[number]) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  if (variant === "top") {
    return (
      <nav className="hidden items-center gap-1 sm:flex">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              isActive(tab) ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-white sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
            isActive(tab) ? "text-teal-700" : "text-slate-500"
          }`}
        >
          <tab.Icon className="h-5 w-5" />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}