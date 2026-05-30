"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  key: string;
}

export function MobileNav({ items, currentPath }: { items: NavItem[]; currentPath?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [currentPath]);

  return (
    <>
      <button
        className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 top-14 z-30 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed inset-x-0 top-14 z-40 border-b bg-background shadow-lg">
            <nav className="mx-auto max-w-7xl px-4 py-3 grid grid-cols-3 sm:grid-cols-4 gap-1">
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-center",
                    currentPath === item.key
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
