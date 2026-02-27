# Shortlist Chrome Extension

Adds a floating "Shortlist this job" button to supported job boards. On click, opens Shortlist with the job description pre-filled.

## Supported job boards
- Greenhouse (`boards.greenhouse.io`, `*.greenhouse.io/jobs/*`)
- Lever (`jobs.lever.co`)
- Workday (`*.workday.com`, `myworkdayjobs.com`)
- Indeed (`www.indeed.com/viewjob`)
- LinkedIn (`www.linkedin.com/jobs/view/*`)

## Installing (development)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `chrome-extension/` directory

## Publishing to Chrome Web Store

1. Create icons (16x16, 48x48, 128x128 PNG) in `icons/`
2. Zip the extension directory: `zip -r shortlist-extension.zip chrome-extension/`
3. Upload to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## How it works

`content.js` runs on job board pages and:
1. Injects a floating indigo button in the bottom-right corner
2. When clicked, extracts the job description using board-specific DOM selectors
3. Opens `shortlist-amber.vercel.app/generate?jd=<encoded-jd>` in a new tab
4. The Shortlist generate page reads `?jd=` on mount and pre-fills the JD field

The `?jd=` URL param integration is already wired in `app/generate/GenerateForm.tsx`.
