# Changelog

## 2026-10-14

- Added `ERROR_LOG.md` to preserve the Cloudflare Quick Tunnel CSP/HMR investigation, including confirmed local response and WebSocket evidence and unresolved tunnel-side evidence.
- Added `CHANGELOG.md` as requested to track investigation-related file changes.
- No application files were changed: local Next responses do not emit CSP, local static data requests succeed, and tunnel response headers were not available to support a configuration change.

## 2026-10-14 — Tunnel diagnostic follow-up

- Appended verified hostname-level evidence to `ERROR_LOG.md`: no CSP header/meta on the 200 tunnel page; matching local/tunnel HTML and script paths; actual data exports and a script asset return 200; local HMR is 101 while tunnel HMR returned Cloudflare 502 with `Retry-After: 60`.
- No application files or security settings changed because the evidence does not support a safe CSP code change. The browser-reported CSP source and the more specific source of Cloudflare's HMR 502 still require user-browser / tunnel diagnostic evidence.

## 2026-10-14 — Next.js HMR origin diagnostics

- Appended version/config findings and a local HMR Origin comparison to `ERROR_LOG.md`. The localhost Origin gets 101; the Quick Tunnel Origin causes the local endpoint to close without an HTTP response. Cloudflare's current Tunnel FAQ says WebSockets are supported; Next 16 documents `allowedDevOrigins` for additional dev hostnames.
- No code changes: the local result points to dev-origin handling, but the running cloudflared logs and affected browser Network entry were not accessible to confirm the exact failing layer. The next step is a user-run debug restart of the existing temporary tunnel, with the interruption/new hostname called out in `ERROR_LOG.md`.

## 2026-10-14 — Allow the confirmed Quick Tunnel dev origin

- Updated `app/next.config.ts` with the exact `allowedDevOrigins` hostname reported by Next.js: `wto-artwork-boundary-conscious.trycloudflare.com`. Preserved the existing output tracing setting; no wildcard, CSP, or unrelated code change.
- Restarted the Next.js 16.3.8 dev server so it loaded the config. The server reached Ready, but its first page compile did not complete during the verification window; localhost HTTP and HMR requests timed out. No cloudflared process was running, so end-to-end tunnel HMR could not be verified. Details and next checks are in `ERROR_LOG.md`.
- Next 16.3.8 also generated `app/AGENTS.md` and `app/CLAUDE.md` during dev startup. These are framework-generated guidance files (the AGENTS file documents that Next re-adds it); they were left in place.
