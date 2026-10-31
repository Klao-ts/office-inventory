import { BranchQrCard } from "@/components/admin/branch-qr-card";

const BRANCH_LIST = [
  { id: "office", label: "Office" },
  { id: "factory", label: "Factory" },
];

export default function QrCodesPage() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branch QR Codes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Download and print these. Staff scan the code for their branch to sign in and withdraw supplies.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {BRANCH_LIST.map((b) => (
          <BranchQrCard key={b.id} label={b.label} branch={b.id} url={`${baseUrl}/b/${b.id}`} />
        ))}
      </div>
    </div>
  );
}