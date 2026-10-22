# Deploy the complete platform from GitHub

The root `render.yaml` describes a Node.js backend service, not a static site. It runs the dashboard API and a compiled eve runtime, keeps SQLite and encrypted OAuth credentials on a persistent disk, and protects the dashboard with owner sign-in.

## Before activation

This Blueprint uses a paid `starter` service and a 1 GB persistent disk. Review the current price in Render before applying it. No service is created by adding this file to GitHub.

Required private host settings:

- `APP_OWNER_PASSWORD`: choose a private password of at least 20 characters. The sign-in username defaults to `owner`.
- `AI_GATEWAY_API_KEY`: your server-side AI Gateway key with available model access and budget. Local subscription logins cannot authorize cloud requests.
- `AI_RUNTIME_PASSWORD`: generated privately by Render; used only between the dashboard backend and its loopback AI runtime.

## Connect GitHub and deploy

1. Connect Render to the GitHub account and allow the `dangerous83/agent-worker` repository.
2. Create a Blueprint from this repository and its `main` branch.
3. Review the service, disk, region, and recurring charges. Fill in the required secrets in Render, not in GitHub source or chat.
4. Apply the Blueprint after approving the charges. Render installs Node.js dependencies and builds the production agent. The local Windows build output is never deployed; Render builds on Linux.
5. Wait for Render's successful deploy status, then open the actual service URL shown in Render. Sign in as `owner` with your chosen password.
6. Open Connections and verify the model using a real response. Complete a real campaign generation before treating the deployment as verified.

`RENDER_EXTERNAL_URL` provides the canonical HTTPS origin automatically. For a custom domain, set `APP_ORIGIN` to its exact HTTPS origin. Production startup refuses missing authentication, storage, runtime credentials, model credentials, or a canonical HTTPS origin.

## GitHub automatic deployment

Render is configured to redeploy `main` only after its GitHub checks pass. GitHub owns the source and checks; Render runs the backend. The repository must be connected through Render's GitHub integration to enable automatic deploys. A public repository URL alone does not enable auto-deploys.

The GitHub checks include API tests, owner-auth tests, persistent-storage tests, type checking, and browser-code syntax checks. The deployment builds an eve production server and launches it with `eve start`, never `eve dev`.

## Storage and restarts

`DATA_DIR` points to `/var/data/agent-worker`. It contains the workspace SQLite database, local encryption key, runtime log, and persisted Workflow run state. A startup symlink connects `.eve/.workflow-data` to the disk. The encryption key and database must be backed up together.

This disk-backed design uses one service instance. A disk-backed deploy can briefly interrupt the service. In-flight dashboard jobs are marked interrupted after a restart rather than silently retried. Increasing traffic or running multiple replicas requires a database/workflow-storage migration.

## Gmail after deployment

Register the deployed service's exact `https://.../auth/gmail/callback` URL in the Google OAuth Web client. Then configure and authorize Gmail from Connections while signed into the private dashboard. The localhost redirect URI is only for local use. Send a deliberately chosen test email only after the owner selects its recipient and approves the content.

## Instagram

Personal Instagram accounts cannot publish through the official publishing API. A Business or Creator account and its integration setup remain necessary. This deployment does not change the account type or claim that Instagram publishing is connected.

## Deployment verification

Confirm the host reports a successful deployment; `/healthz` is reachable; unauthenticated dashboard/API requests receive `401`; owner sign-in works; the AI runtime starts; a real model check succeeds; a real campaign is saved; and saved records survive a restart. Gmail delivery needs its own authorized real-send check. Until those checks pass, report the deployment as pending or partially verified.

References:

- https://render.com/docs/infrastructure-as-code
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploys
- https://render.com/docs/disks
- https://eve.dev/docs/guides/deployment/self-hosting
