import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border-subtle)] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/nickskotadis/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
            >
              Nick Skotadis
            </a>
          </p>

          <nav className="flex items-center gap-1 flex-wrap justify-center">
            <a
              href="https://www.linkedin.com/in/nickskotadis/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] rounded transition-all"
            >
              LinkedIn
            </a>
            <span className="text-[var(--color-separator)] text-xs">·</span>
            <a
              href="https://github.com/nickskotadis/Shortlist"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] rounded transition-all"
            >
              GitHub
            </a>
            <span className="text-[var(--color-separator)] text-xs">·</span>
            <Link
              href="/privacy"
              className="px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] rounded transition-all"
            >
              Privacy Policy
            </Link>
            <span className="text-[var(--color-separator)] text-xs">·</span>
            <Link
              href="/pricing"
              className="px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] rounded transition-all"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
