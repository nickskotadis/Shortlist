import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "./UserMenu";

interface NavProps {
  activePage?: "dashboard" | "applications" | "generate" | "score";
  maxWidth?: string;
  actions?: React.ReactNode;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", page: "dashboard" },
  { href: "/applications", label: "Applications", page: "applications" },
  { href: "/generate", label: "Generate", page: "generate" },
  { href: "/score", label: "Score", page: "score" },
] as const;

export default async function Nav({ activePage, maxWidth = "max-w-7xl", actions }: NavProps) {
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
    <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
      <div className={`${maxWidth} mx-auto flex items-center justify-between`}>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-base font-semibold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors"
          >
            Shortlist
          </Link>
          {user && (
            <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
              {NAV_LINKS.map((link) =>
                activePage === link.page ? (
                  <span key={link.href} className="font-medium text-slate-900">
                    {link.label}
                  </span>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-slate-900 transition-colors"
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
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-indigo-700 bg-indigo-50">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                  Pro
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-slate-500 bg-slate-100">
                  Free
                  <Link
                    href="/pricing"
                    className="text-indigo-600 hover:text-indigo-700 font-semibold ml-0.5 transition-colors"
                  >
                    Upgrade →
                  </Link>
                </span>
              )}
              <UserMenu email={user.email!} />
            </>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
