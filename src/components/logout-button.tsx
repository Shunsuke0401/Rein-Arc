"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setBusy(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={busy}
      title="Sign out"
    >
      {children}
    </Button>
  );
}
