# Agent Worker

A personal AI marketing workspace with a pixel-art office, real eve agent sessions, campaign editing, and a Gmail OAuth sending integration. Node.js 24 is required.

## Current verified status

- The dashboard starts its local AI service automatically (or reuses an existing healthy service).
- Connections distinguishes service availability from a verified model response. A running service is never enough to mark the model ready.
- AI model credentials are not included. The owner chose to complete model sign-in themselves. Live campaign generation remains blocked until that connection succeeds.
- Gmail authorization, encrypted token storage, refresh, and sending are implemented. The owner must supply a Google Web OAuth client and authorize Gmail before real delivery can be verified.
- Instagram is a personal account. Instagram's official publishing API requires a Business or Creator account; no direct publishing integration is connected or claimed.
- The app is local. There is no verified public deployment. Vercel returned 403 for the owner's project team even after the owner reported granting access; the requested team-authorization tool is unavailable in the current session.

## Deploy automatically from GitHub

The repository includes render.yaml for a full Node backend with a 1 GB persistent disk, owner sign-in, and automatic deployment after GitHub checks pass. See [the deployment guide](docs/deployment.md). Activating it requires connecting Render, reviewing its paid service/disk charges, and setting the private owner password and server-side model key. The Blueprint is prepared; it is not proof of a live deployment.

## Run the whole app

1. Install Node.js 24 and run npm ci in this repository.
2. Run npm start (npm run dev and npm run web also start the complete app).
3. Open http://127.0.0.1:3100.

The dashboard starts the AI runtime on loopback port 2000. It keeps running if the AI process fails, and Connections offers a startup retry. Runtime diagnostics are in data/agent-runtime.log, which is excluded from Git.

## Connect your model

Double-click Connect Model.cmd. In the terminal type /login, choose a supported model connection, and complete sign-in yourself. Return to Connections and click Check model connection. The app only marks the model ready after a real validated response. Provider usage charges may apply.

Alternatively, copy .env.example to .env.local, configure AI_GATEWAY_API_KEY, and restart. Model login credentials entered through eve's /login are managed by eve's OS secret store. Never paste credentials into campaign briefs, GitHub, or chat.

## Connect Gmail

In Google Cloud, enable the Gmail API, configure the OAuth consent screen, and create a Web application OAuth client. For personal testing, add your Gmail address to the consent screen's test users.

Register this exact redirect URI:
http://127.0.0.1:3100/auth/gmail/callback

In Connections, save the client ID and secret and click Connect Gmail. Google requests the gmail.send scope plus openid/email to identify the sending account. The app does not request permission to read your inbox.

Tokens and OAuth client secrets are encrypted with AES-256-GCM in the local SQLite database. The encryption key is data/.secret-key. Both the key and database are excluded from Git. Back them up together if you need to retain connections.

To send: save and approve a campaign, open it, click Send with Gmail, enter the recipient, review the saved subject and body, then click Send email now. The app only records sent after Gmail returns a message ID. Repeated requests with the same send ID are deduplicated. A network failure after dispatch is marked uncertain; check Gmail Sent before attempting another send. Disconnect removes the local connection; use your Google account settings if you also want to revoke the app's Google authorization.

## The office is connected to real work

Characters roam when idle. Clicking a character selects them and prepares a role-specific brief; it does not fabricate a working session. Typing and active monitors are driven by actual manager/specialist progress events from the eve stream. The office bulletin reports actual job progress and failures. Previous developer-created sample campaign data is archived locally rather than counted as real work.

## What the creative tools produce

The campaign studio saves Instagram captions, email copy, and image direction. Its downloadable 1080 x 1080 ad is a typography layout. The image direction is a text brief, not an AI-generated photograph. Planning dates are organizational fields, not a live scheduler.

## Hosting

Local mode binds to loopback. Production mode requires a canonical HTTPS origin, strong owner sign-in, a protected internal AI runtime, persistent DATA_DIR, and a server-side model key before startup. The production build uses eve start and fails closed without internal authentication. The health route is public and only returns an availability flag. Gmail OAuth uses the hosted HTTPS callback and Secure cookies in production. Local subscription login does not authorize cloud inference. No static-only or dummy deployment is included.

## Verification

npm test runs fourteen API, persistence, OAuth, token-vault, sending, deduplication, and failure-status checks. External Gmail responses in those tests are controlled fixtures; no email is sent by the tests. npm run typecheck checks the agent definitions. Browser QA checks the real connection screen and model-check error handling. Live campaign generation and Gmail delivery are not verified without the owner's accounts.

Framework: https://eve.dev/docs
Google OAuth: https://developers.google.com/identity/protocols/oauth2/web-server
Gmail sending: https://developers.google.com/workspace/gmail/api/guides/sending
Instagram: https://developers.facebook.com/docs/instagram-platform/
