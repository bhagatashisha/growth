"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, Building2, Mail } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";

interface Props {
  email: string;
  orgName: string;
}

export function ProfileMenu({ email, orgName }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const initials = email.split("@")[0].slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent transition-colors hover:bg-accent/25"
        aria-label="Profile"
        title={email}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border border-border bg-background shadow-lg">
          <div className="px-4 py-3 border-b border-border space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium truncate">{orgName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{email}</span>
            </div>
          </div>
          <div className="p-1.5">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
