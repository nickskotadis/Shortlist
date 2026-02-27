import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  debug: false,
  beforeSend(event) {
    // Strip PII — never send content fields to Sentry
    if (event.extra) {
      const piiKeys = ["candidate_input", "jd_text", "resume_text", "output_text"];
      for (const key of piiKeys) {
        if (key in event.extra) {
          delete event.extra[key];
        }
      }
    }
    return event;
  },
});
