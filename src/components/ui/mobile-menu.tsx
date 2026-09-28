"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SagolikLockup } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

/** Full-screen navigation sheet for narrow viewports. Closes on navigation and Escape. */
export function MobileMenu({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const id = useId();

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-surface-2"
      >
        <MenuIcon open={false} />
      </button>
      {open &&
        // Portaled: an ancestor with backdrop-filter would otherwise become the containing block.
        createPortal(
          <div
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-0 z-50 flex flex-col bg-canvas"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <span className="text-brand">
                <SagolikLockup className="h-[20px]" />
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-surface-2"
              >
                <MenuIcon open />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">{children}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path className={cn(open && "hidden")} d="M3 6h12M3 12h12" />
      <path className={cn(!open && "hidden")} d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
    </svg>
  );
}
