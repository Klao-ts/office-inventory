"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  );
}
