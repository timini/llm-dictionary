# Basic GA4 page views

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to the verified web stream ID and
`NEXT_PUBLIC_GA_HOSTNAME` to the exact production hostname before building.
Both values are public and baked into the client bundle. A runtime-only secret
change does not update the Next.js client bundle. Missing or malformed ID, missing
hostname, and other hosts do not load Google Analytics.

This integration records page views only. It sends a fixed application title,
blank referrer, and an allowlisted pathname. Query strings, fragments, dynamic
record IDs, prompts, uploaded documents, dictionary words and message contents
are never included in the explicit payload. Google signals and advertising
personalization are disabled in configuration.

Before production rollout, disable Enhanced Measurement and its automatic
history/page-view capture on this dedicated stream to avoid duplicate events
and automatic capture outside this minimal scope. No existing consent handling was found. This integration sets analytics
storage and all advertising consent categories to denied before configuration;
it does not grant consent or store Analytics cookies. Consent Mode may still
send cookieless measurement pings. Any future consent grant requires a separate
approved consent implementation. Do not add session replay or user IDs.

Verify in the deployed bundle and GA Realtime after rollout. A configured ID
alone is not evidence of received events. No deployment has been performed.

Configured property 565332588, stream `G-KYD611CMTW`; Enhanced Measurement disabled.
Deployment requires a separately validated upgrade to a supported Next.js major; current Next 15 is rejected by the adapter support-policy guard. The unsupported-version override was not used.
