/**
 * Shortlist Chrome Extension — content.js
 *
 * Injects a floating "Shortlist this job" button on supported job boards.
 * Extracts the job description text and opens Shortlist with ?jd= pre-filled.
 *
 * Supported: Greenhouse, Lever, Workday, Indeed, LinkedIn (view-only, no API)
 */

const SHORTLIST_APP_URL = "https://shortlist-amber.vercel.app";

// ── DOM extraction strategies per job board ───────────────────────────────────

function extractJobDescription() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Greenhouse — boards.greenhouse.io/company/jobs/id
  if (hostname.includes("greenhouse.io")) {
    const el =
      document.querySelector("#content .job-post__description") ??
      document.querySelector(".job-post__content") ??
      document.querySelector("#job-post__content") ??
      document.querySelector("[class*='job-description']") ??
      document.querySelector(".posting-description");
    if (el) return el.innerText.trim();
  }

  // Lever — jobs.lever.co/company/id
  if (hostname.includes("lever.co")) {
    const el =
      document.querySelector(".posting-requirements") ??
      document.querySelector(".content-wrapper section") ??
      document.querySelector("[class*='posting']");
    if (el) return el.innerText.trim();
  }

  // Workday — various *.workday.com/*/job/* patterns
  if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com")) {
    const el =
      document.querySelector("[data-automation-id='jobPostingDescription']") ??
      document.querySelector("[class*='job-description']") ??
      document.querySelector("[class*='jobDescription']");
    if (el) return el.innerText.trim();
  }

  // Indeed — indeed.com/viewjob
  if (hostname.includes("indeed.com")) {
    const el =
      document.querySelector("#jobDescriptionText") ??
      document.querySelector(".jobDescriptionText") ??
      document.querySelector("[class*='description']");
    if (el) return el.innerText.trim();
  }

  // LinkedIn — linkedin.com/jobs/view/id
  if (hostname.includes("linkedin.com") && pathname.includes("/jobs/view/")) {
    const el =
      document.querySelector(".jobs-description__content") ??
      document.querySelector(".jobs-description-content__text") ??
      document.querySelector("[class*='description__content']");
    if (el) return el.innerText.trim();
  }

  // Generic fallback — look for the largest text block with job-related keywords
  const candidates = Array.from(document.querySelectorAll(
    "section, article, div[class*='description'], div[class*='content'], main"
  ));

  const jobKeywords = ["responsibilities", "requirements", "qualifications", "experience", "skills"];
  const scored = candidates
    .filter((el) => {
      const text = el.innerText ?? "";
      return (
        text.length > 500 &&
        jobKeywords.some((kw) => text.toLowerCase().includes(kw))
      );
    })
    .sort((a, b) => (b.innerText?.length ?? 0) - (a.innerText?.length ?? 0));

  if (scored.length > 0) return scored[0].innerText.trim();

  return null;
}

// ── Inject floating button ────────────────────────────────────────────────────

function injectButton() {
  if (document.getElementById("shortlist-ext-btn")) return;

  const btn = document.createElement("button");
  btn.id = "shortlist-ext-btn";
  btn.setAttribute("aria-label", "Shortlist this job");
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
    <span>Shortlist this job</span>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #shortlist-ext-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 10px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    #shortlist-ext-btn:hover {
      background: #4338ca;
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(79, 70, 229, 0.5);
    }
    #shortlist-ext-btn:active {
      transform: translateY(0);
    }
    #shortlist-ext-btn.shortlist-loading span::after {
      content: "...";
    }
    #shortlist-ext-btn svg { flex-shrink: 0; }
  `;

  document.head.appendChild(style);

  btn.addEventListener("click", () => {
    btn.classList.add("shortlist-loading");
    btn.querySelector("span").textContent = "Opening Shortlist";

    const jdText = extractJobDescription();

    if (!jdText) {
      btn.querySelector("span").textContent = "No JD found — opening Shortlist";
      setTimeout(() => {
        window.open(SHORTLIST_APP_URL + "/generate", "_blank");
        btn.querySelector("span").textContent = "Shortlist this job";
        btn.classList.remove("shortlist-loading");
      }, 500);
      return;
    }

    const encoded = encodeURIComponent(jdText.slice(0, 12000)); // limit to 12k chars
    const url = `${SHORTLIST_APP_URL}/generate?jd=${encoded}`;
    window.open(url, "_blank");

    setTimeout(() => {
      btn.querySelector("span").textContent = "Shortlist this job";
      btn.classList.remove("shortlist-loading");
    }, 1000);
  });

  document.body.appendChild(btn);
}

// Run on page load and after dynamic page updates (SPAs like LinkedIn)
function init() {
  // Wait for DOM to stabilize
  setTimeout(injectButton, 1500);
}

init();

// Re-inject on URL change for SPAs
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    document.getElementById("shortlist-ext-btn")?.remove();
    setTimeout(injectButton, 1500);
  }
}).observe(document, { subtree: true, childList: true });
