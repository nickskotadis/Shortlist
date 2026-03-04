// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ef9bf1a3f18681ad7cf818585f519d54@o4510966618521600.ingest.us.sentry.io/4510966620618752",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send user IPs, emails, or request bodies to Sentry
  sendDefaultPii: false,
});
