"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function BranchSignOut() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await supabase.auth.signOut();
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}