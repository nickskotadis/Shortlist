"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", page: "dashboard" },
  { href: "/applications", label: "Applications", page: "applications" },
  { href: "/generate", label: "Generate", page: "generate" },
  { href: "/score", label: "Score", page: "score" },
  { href: "/interview", label: "Interview", page: "interview" },
] as const;

export default function NavMobileMenu({ activePage }: { activePage?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#8888A8] hover:text-[#EEEEFC] hover:bg-[#13182C] transition-colors"
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
        <div className="fixed top-14 inset-x-0 bg-[#090C18] border-b border-[#1A1D38] z-50 sm:hidden">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) =>
              activePage === link.page ? (
                <span
                  key={link.href}
                  className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-[#EEEEFC] bg-[#13182C] border border-[#232548]"
                >
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-[#8888A8] hover:text-[#EEEEFC] hover:bg-[#13182C] transition-all"
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
