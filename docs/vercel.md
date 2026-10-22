# Agent Worker on Vercel

The Next.js application serves the same pixel office and dashboard through `app/route.js`. `eve/next` deploys the AI transport as its own managed Vercel service. Cloud APIs use Neon Postgres, never a local SQLite file. The existing `npm start` remains the local Windows application; Render uses `npm run build:agent`.

Import `dangerous83/agent-worker`, use the **Next.js** preset, root `./`, build `npm run build`. No custom output directory. The production build and all 20 tests pass locally.

## Private environment settings

- Connect a Neon Postgres database through Vercel Storage. This supplies `DATABASE_URL`. Review the selected provider plan and terms before provisioning.
- `APP_OWNER_USER`: defaults to `owner`.
- `APP_OWNER_PASSWORD`: at least 12 characters. Set this privately in Vercel, not GitHub.
- `CREDENTIAL_ENCRYPTION_KEY`: exactly 64 hexadecimal characters from a secure random 32-byte generator. Keep this key stable; replacing it prevents decrypting existing Google credentials.
- AI Gateway uses the Vercel deployment identity via OIDC. The project's model access, quota and billing must permit inference. No model call occurs merely by visiting the setup screen.
- Google credentials can be configured in the authenticated Connections screen, or through `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register the actual production origin plus `/auth/gmail/callback` in Google Cloud.

Redeploy after updating environment settings. Missing critical settings produce a locked setup page and 503 API responses. Nothing falls back to temporary or browser-only storage. Do not describe that setup page as a fully working deployment.

## Persistence and background work

Cloud records live in `agent_worker_documents` with separate namespaces for campaigns, jobs, messages, reminders, notices, OAuth state and encrypted credentials. Queries are parameterized. Database leases prevent overlapping campaign/chat runs across instances. Atomic delivery claims deduplicate Gmail requests. OAuth state and one-use claims work across instances.

Vercel `waitUntil` keeps request-triggered campaign and chat tasks alive after the 202 response, within the 300-second function duration. The eve runtime manages model sessions durably. Dashboard status marks unfinished invocations failed after five minutes and never silently retries inference or sends. This implementation does not promise to resume the dashboard's assembly step after abrupt process termination.

Reminders are in-app and evaluated when the inbox is polled. Instagram publishing and scheduled publishing are not implemented. No public posts or Gmail deliveries have been verified without connected accounts.

## Migration from local data

Local data remains in the existing SQLite file. This deployment does not upload it or its encryption key automatically. The hosted workspace starts separately. An explicit data migration is needed to transfer existing campaigns or conversations; reconnect Gmail in the cloud workspace. Keep local data backed up.

## Verification

`npm test` covers existing local behavior plus cloud access gates, background jobs across request-handler instances, worker chats, encrypted secrets, cross-instance Google OAuth, and concurrent Gmail deduplication. External Google/model responses are test fixtures. A real Neon connection, live model reply and real Gmail delivery require the deployed project's accounts and credentials.
