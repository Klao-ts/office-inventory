"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Branch } from "@/lib/branches";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function GoogleSignIn({
  branch,
  branchLabel,
  domainHint,
}: {
  branch: Branch;
  branchLabel: string;
  domainHint: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/b/${branch}`,
        queryParams: { prompt: "select_account", hd: domainHint },
      },
    });

    if (error) {
      toast.error("Could not start Google sign-in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in to {branchLabel}</CardTitle>
        <CardDescription>Use your company Google account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={signIn} disabled={busy}>
          {busy ? "Opening Google..." : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}