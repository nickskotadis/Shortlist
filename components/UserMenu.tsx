"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

function getInitials(email: string): string {
  return email[0].toUpperCase();
}

export default function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = getInitials(email);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-contrast)] text-xs font-semibold flex items-center justify-center hover:bg-[var(--color-accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-page)]"
        aria-label="User menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] shadow-lg shadow-[var(--color-shadow)] z-20">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <p className="text-xs text-[var(--color-text-tertiary)] mb-0.5">Signed in as</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{email}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/auth/logout"
              prefetch={false}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] rounded transition-colors"
              onClick={() => setOpen(false)}
            >
              <svg className="w-4 h-4 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
