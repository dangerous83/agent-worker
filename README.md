# Agent Worker

A personal AI marketing workspace for Instagram creative and email drafts. Built with Node.js 24, SQLite, and eve 0.82.0.

## What works

- Interactive pixel-art office as the opening dashboard: four walking characters, workstations, a lounge, and a coffee corner.
- Click Milo, Luna, Kai, or Nova to meet them, preview their work animation, and open a role-specific campaign brief.
- Characters go to their desks while a real campaign job runs. Animation previews are explicitly labeled; clicking alone never dispatches a job.
- Pause/resume controls, keyboard-accessible characters, and reduced-motion support.
- Campaign studio and persistent brand memory.
- Create, edit, save, and approve Instagram/email campaign drafts.
- Live square ad typography preview and 1080 x 1080 PNG downloads.
- Copy Instagram captions and open email drafts in your default email app.
- AI manager with Instagram, email, and review specialists through eve.
- Background generation jobs with persisted success/failure status.
- Planning dates for organization (not automatic scheduling or reminders).

## Run locally

1. Install Node.js 24.
2. Clone this repository and run npm ci.
3. Run npm run dev.
4. Open http://127.0.0.1:3100.

To use the editor without AI, run npm run web.

## Connect the AI staff

Copy .env.example to .env.local and set AI_GATEWAY_API_KEY to your own Vercel AI Gateway credential, then restart npm run dev. Alternatively, connect a supported model account using the eve terminal UI (npm exec -- eve dev, then /login). The browser dashboard checks runtime availability, not model credential validity. A runtime can be online while the model still needs login.

AI credentials are required for generation and may incur provider usage charges. No model key is included. Never paste credentials into GitHub, brand memory, campaign briefs, or public source files.

## Current connection limits

Instagram direct publishing, automated email sending, paid ads, delivery analytics, AI-generated photography, and background scheduling are NOT implemented in this first version. The Connections page reports these limits. Email opens a mailto draft; the owner chooses the recipient and sends. Approval is a local review marker and never triggers sending or posting. Image direction is a text prompt; the downloadable ad is a typography design.

Next integration work requires the owner's Instagram account authorization and chosen email provider. Keep tokens server-side. Do not add fake connected states or pretend a draft has been delivered.

## Privacy and hosting

This is a local personal application. The dashboard binds only to 127.0.0.1 and checks Host and Origin headers. The eve runtime also binds to loopback; its production channel fails closed. Data is stored in data/workspace.sqlite (ignored by Git). AI generation sends the supplied brief and brand context to the configured AI model. GitHub contains source code only.

This repository is not a publicly hosted app. Do not expose the development server to the internet. Remote hosting requires owner authentication, a persistent database, secure runtime route authentication, and a supported eve hosting/sandbox configuration. The build script compiles the agent runtime, not a full hosted dashboard deployment.

## Verification

Run npm test and npm run typecheck. Integration tests exercise the real HTTP API and SQLite with an injected test agent; they do not claim to test live model credentials or social/email delivery. The dashboard, manual campaign creation, approval, and persistence were checked in a browser. The real eve runtime started and its health/info routes worked. A live model turn was blocked by an unavailable model connection; generation remains unverified until a model is connected.

## Structure

- public/: responsive dashboard and campaign editor.
- workspace.mjs: local HTTP API and static app server.
- lib/store.mjs: SQLite persistence.
- lib/agent.mjs: eve client and structured campaign validation.
- agent/: manager, specialist definitions, and route protection.
- scripts/dev.mjs: local dashboard and agent runtime launcher.
- tests/: API and persistence integration tests.

## Official framework guidance

See https://eve.dev/docs for model connections, runtime hosting, and integration support.
