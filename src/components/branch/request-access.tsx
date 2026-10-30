"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Branch } from "@/lib/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BranchSignOut } from "@/components/branch/branch-sign-out";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RequestAccess({
  branch,
  branchLabel,
  email,
  name,
}: {
  branch: Branch;
  branchLabel: string;
  email: string;
  name: string;
}) {
  const router = useRouter();
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, department }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your request");

      toast.success("Request sent. An administrator will review it.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request access to {branchLabel}</CardTitle>
        <CardDescription>
          Signed in as {name ? `${name} · ` : ""}
          {email}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="request-department">Your department</Label>
            <Input
              id="request-department"
              placeholder="e.g. Finance"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || department.trim().length < 2}>
            {busy ? "Sending..." : "Request access"}
          </Button>
        </form>
        <div className="mt-4">
          <BranchSignOut />
        </div>
      </CardContent>
    </Card>
  );
}