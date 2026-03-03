"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

function getInitials(email: string): string {
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.substring(0, 2).toUpperCase();
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
        className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#090C18]"
        aria-label="User menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0D1122] rounded-xl border border-[#232548] shadow-2xl shadow-black/50 z-20">
          <div className="px-4 py-3 border-b border-[#1A1D38]">
            <p className="text-xs text-[#5A5A80] mb-0.5">Signed in as</p>
            <p className="text-sm font-medium text-[#EEEEFC] truncate">{email}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/auth/logout"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#8888A8] hover:text-[#EEEEFC] hover:bg-[#13182C] rounded-lg transition-colors"
              onClick={() => setOpen(false)}
            >
              <svg className="w-4 h-4 text-[#5A5A80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
