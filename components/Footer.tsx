import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#1A1D38] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#5A5A80]">
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/nickskotadis/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8888A8] hover:text-[#EEEEFC] transition-colors"
            >
              Nick Skotadis
            </a>
          </p>

          <nav className="flex items-center gap-1 flex-wrap justify-center">
            <a
              href="https://www.linkedin.com/in/nickskotadis/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs text-[#5A5A80] hover:text-[#EEEEFC] hover:bg-[#13182C] rounded-lg transition-all"
            >
              LinkedIn
            </a>
            <span className="text-[#363960] text-xs">·</span>
            <a
              href="https://github.com/nickskotadis/Shortlist"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs text-[#5A5A80] hover:text-[#EEEEFC] hover:bg-[#13182C] rounded-lg transition-all"
            >
              GitHub
            </a>
            <span className="text-[#363960] text-xs">·</span>
            <Link
              href="/privacy"
              className="px-3 py-1.5 text-xs text-[#5A5A80] hover:text-[#EEEEFC] hover:bg-[#13182C] rounded-lg transition-all"
            >
              Privacy Policy
            </Link>
            <span className="text-[#363960] text-xs">·</span>
            <Link
              href="/pricing"
              className="px-3 py-1.5 text-xs text-[#5A5A80] hover:text-[#EEEEFC] hover:bg-[#13182C] rounded-lg transition-all"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
