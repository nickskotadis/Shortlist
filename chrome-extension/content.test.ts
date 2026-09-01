// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";

import content from "./content.js";

const { detectBoard, extractJobDescription, MIN_JD_CHARS, MAX_JD_CHARS } = content;

function setUrl(url: string) {
  (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(url);
}

// A representative posting body — fake company, realistic structure, and long
// enough (with JD keywords) to clear the MIN_JD_CHARS plausibility threshold.
const JD_TEXT_MARKER = "Senior Platform Engineer at Acme Rocketry";
const JD_BODY_HTML = `
  <h1>${JD_TEXT_MARKER}</h1>
  <h2>Responsibilities</h2>
  <p>Own the ingestion pipeline end to end, from webhook intake through queue
  processing to the reporting warehouse. Partner with product engineering to
  ship customer-facing telemetry features every sprint.</p>
  <h2>Requirements</h2>
  <ul>
    <li>Six or more years of experience building backend services in production.</li>
    <li>Deep working knowledge of PostgreSQL, including query planning and indexes.</li>
    <li>Experience operating services on a major cloud provider.</li>
  </ul>
  <h2>Qualifications and skills</h2>
  <p>We value clear written communication, a bias toward instrumentation, and
  the judgment to know when a prototype should become a platform.</p>
`;

// Each board's page skeleton wraps the same JD body in the container that
// board's primary selector targets — the real shape the extractor codes against.
const BOARDS: Array<{
  board: string;
  url: string;
  expectedSelector: string;
  html: string;
}> = [
  {
    board: "greenhouse",
    url: "https://boards.greenhouse.io/acmerocketry/jobs/4012345",
    expectedSelector: "#content .job-post__description",
    html: `<div id="content"><div class="job-post__description">${JD_BODY_HTML}</div></div>`,
  },
  {
    board: "lever",
    url: "https://jobs.lever.co/acmerocketry/1f2e3d4c-5b6a",
    expectedSelector: "[data-qa='job-description']",
    html: `<div class="posting"><div data-qa="job-description">${JD_BODY_HTML}</div></div>`,
  },
  {
    board: "workday",
    url: "https://acmerocketry.wd1.myworkdayjobs.com/en-US/careers/job/Remote/Senior-Platform-Engineer_R-01234",
    expectedSelector: "[data-automation-id='jobPostingDescription']",
    html: `<div data-automation-id="jobPostingDescription">${JD_BODY_HTML}</div>`,
  },
  {
    board: "indeed",
    url: "https://www.indeed.com/viewjob?jk=abc123def456",
    expectedSelector: "#jobDescriptionText",
    html: `<div id="jobDescriptionText">${JD_BODY_HTML}</div>`,
  },
  {
    board: "linkedin",
    url: "https://www.linkedin.com/jobs/view/3948217402/",
    expectedSelector: ".jobs-description__content",
    html: `<div class="jobs-description__content">${JD_BODY_HTML}</div>`,
  },
];

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("detectBoard", () => {
  for (const { board, url } of BOARDS) {
    it(`identifies ${board} from its URL`, () => {
      setUrl(url);
      expect(detectBoard()).toBe(board);
    });
  }

  it("returns unknown for an unsupported host", () => {
    setUrl("https://example.com/careers/123");
    expect(detectBoard()).toBe("unknown");
  });

  it("does not treat a non-job LinkedIn page as a job posting", () => {
    setUrl("https://www.linkedin.com/feed/");
    expect(detectBoard()).toBe("unknown");
  });
});

describe("extractJobDescription — normalizes every board into the canonical payload", () => {
  for (const { board, url, expectedSelector, html } of BOARDS) {
    it(`normalizes a ${board} posting`, () => {
      setUrl(url);
      document.body.innerHTML = html;

      const result = extractJobDescription();

      // Canonical shape: { text, path, selector, length, board } — correctly typed.
      expect(typeof result.text).toBe("string");
      expect(result.text).toContain(JD_TEXT_MARKER);
      expect(result.text).toContain("Responsibilities");
      expect(result.text.length).toBeGreaterThanOrEqual(MIN_JD_CHARS);
      expect(result.path).toBe(`board:${board}`);
      expect(result.selector).toBe(expectedSelector);
      expect(result.length).toBe(result.text.length);
      expect(result.board).toBe(board);
    });
  }
});

describe("extractJobDescription — layered fallback", () => {
  it("falls through to the generic layer when the board container is too thin", () => {
    setUrl(BOARDS[0].url); // greenhouse
    document.body.innerHTML = `
      <div id="content"><div class="job-post__description">Apply now</div></div>
      <main>${JD_BODY_HTML}</main>
    `;

    const result = extractJobDescription();

    expect(result.path).toBe("generic:main");
    expect(result.text).toContain(JD_TEXT_MARKER);
    expect(result.length).toBeGreaterThanOrEqual(MIN_JD_CHARS);
    expect(result.board).toBe("greenhouse");
  });

  it("reports path 'none' instead of fabricating a result on an empty page", () => {
    setUrl(BOARDS[0].url);
    document.body.innerHTML = `<div id="content"><div class="job-post__description">Apply</div></div>`;

    const result = extractJobDescription();

    expect(result.path).toBe("none");
    expect(result.text.length).toBeLessThan(MIN_JD_CHARS);
    expect(result.board).toBe("greenhouse");
  });
});

describe("payload limits", () => {
  it("keeps the extension's JD cap under the app's 20k ?jd= URL-param cap", () => {
    // GenerateForm drops ?jd= params over 20,000 chars (BUG-17); the extension
    // must always send less than that or captured postings get silently ignored.
    expect(MAX_JD_CHARS).toBeLessThan(20_000);
    expect(MIN_JD_CHARS).toBeGreaterThan(0);
  });
});
