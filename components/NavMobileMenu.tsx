"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", page: "dashboard" },
  { href: "/applications", label: "Applications", page: "applications" },
  { href: "/generate", label: "Generate", page: "generate" },
  { href: "/fit", label: "Fit", page: "fit" },
  { href: "/score", label: "Score", page: "score" },
  { href: "/interview", label: "Interview", page: "interview" },
  { href: "/negotiate", label: "Negotiate", page: "negotiate" },
] as const;

export default function NavMobileMenu({ activePage }: { activePage?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-colors"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed top-14 inset-x-0 bg-[var(--color-page)] border-b border-[var(--color-border-subtle)] z-50 sm:hidden">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) =>
              activePage === link.page ? (
                <span
                  key={link.href}
                  className="flex items-center px-4 py-3 rounded-md text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-elevated)] border border-[var(--color-border)]"
                >
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-4 py-3 rounded-md text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
