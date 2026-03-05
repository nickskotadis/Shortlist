import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "./UserMenu";
import NavMobileMenu from "./NavMobileMenu";

interface NavProps {
  activePage?: "dashboard" | "applications" | "generate" | "score" | "interview" | "fit" | "negotiate";
  actions?: React.ReactNode;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", page: "dashboard" },
  { href: "/applications", label: "Applications", page: "applications" },
  { href: "/generate", label: "Generate", page: "generate" },
  { href: "/fit", label: "Fit", page: "fit" },
  { href: "/score", label: "Score", page: "score" },
  { href: "/interview", label: "Interview", page: "interview" },
  { href: "/negotiate", label: "Negotiate", page: "negotiate" },
] as const;

export default async function Nav({ activePage, actions }: NavProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: "free" | "pro" = "free";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    plan = (data?.plan as "free" | "pro") ?? "free";
  }

  return (
    <nav className="bg-[var(--color-nav-bg)] backdrop-blur-xl border-b border-[var(--color-border-subtle)] sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight hover:text-indigo-400 transition-colors mr-4"
          >
            Shortlist
          </Link>
          {user && (
            <div className="hidden sm:flex items-center gap-0.5">
              {NAV_LINKS.map((link) =>
                activePage === link.page ? (
                  <span
                    key={link.href}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-elevated)] border border-[var(--color-border)]"
                  >
                    {link.label}
                  </span>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {actions}
          {user ? (
            <>
              {plan === "pro" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/50">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  Pro
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-[var(--color-text-secondary)] bg-[var(--color-elevated)] border border-[var(--color-border)]">
                  Free
                  <Link
                    href="/pricing"
                    className="text-indigo-400 hover:text-indigo-300 font-semibold ml-0.5 transition-colors"
                  >
                    Upgrade →
                  </Link>
                </span>
              )}
              <UserMenu email={user.email!} />
              <NavMobileMenu activePage={activePage} />
            </>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
