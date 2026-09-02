// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ef9bf1a3f18681ad7cf818585f519d54@o4510966618521600.ingest.us.sentry.io/4510966620618752",

  // Session Replay. Resume and JD text are typed into this app, so masking is
  // pinned explicitly rather than left to the library default.
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Do not send user IPs, emails, or request bodies to Sentry — matches the
  // server/edge configs and the claim made in the privacy policy.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
