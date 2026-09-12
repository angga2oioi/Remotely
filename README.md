# Remotely

A desktop app (Electron + React + Tailwind) for managing AWS EC2 instances and
running operational runbooks — without hunting for the right PEM key or
remembering the exact sequence of commands.

## What it does

- **Projects** — group your work by project, each with its own AWS
  credentials (stored encrypted at rest via Electron's OS-backed
  `safeStorage`, never exposed to the renderer).
- **EC2 list** — see all instances for a project's AWS account/region, with
  live state, and local (in-app only, never sent to AWS) tags for organizing
  and filtering instances.
- **Runbooks** — save a named shell command sequence once (e.g. "Restart
  nginx"), then run it against any instance straight from the list via
  [AWS Systems Manager Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-run-command.html) —
  no SSH or PEM key needed at run time.
  - Commands can include `{{variable}}` placeholders — the app prompts for a
    value for each one right before running, so one runbook can be reused
    across different services/hosts/values instead of hardcoding them.
  - Runbooks can be exported/imported as JSON files or via the clipboard to
    share with teammates or other projects (only the name + commands are
    included — never credentials or instance ids).
- **SSM onboarding** — if an instance isn't yet managed by SSM, the app
  diagnoses why (missing IAM instance profile vs. agent not installed/running)
  and fixes both in one action: it attaches an IAM role with
  `AmazonSSMManagedInstanceCore` via the AWS API, then SSHes in once (using a
  key you already have) to install/restart the SSM Agent — after that,
  everything else goes through SSM instead of SSH. Instances that aren't
  manageable yet only show that one action, not a runbook picker that would
  just fail.
- **Agent Mode** — describe what you want in plain English (e.g. "restart
  nginx on the jenkins box") and a chat-style agent matches it to the right
  instance and runbook, then asks you to confirm before running anything —
  fuzzy matching never executes unconfirmed. It's provider-agnostic: point it
  at any OpenAI-compatible `chat/completions` endpoint (OpenAI, Azure OpenAI,
  OpenRouter, Ollama, vLLM, a LiteLLM proxy, etc.) with your own base URL, API
  key, and model name — nothing is tied to one vendor.
- **Backup / move to another device** — export every project (with its AWS
  credentials), runbook, instance tag, and Agent Mode setting into one file,
  protected by a password you choose. Import replaces everything on the
  target device with what's in the file. See [Notes](#notes) for how secrets
  stay protected across that move.

## Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) for the app shell/build
- React 18 + Tailwind CSS for the UI
- `@aws-sdk/client-ec2`, `@aws-sdk/client-ssm`, `@aws-sdk/client-iam` for AWS calls
- `ssh2` for the one-time SSM bootstrap connection
- Agent Mode talks to any OpenAI-compatible endpoint over plain `fetch` — no SDK dependency

## Getting started

```bash
npm install
npm run dev      # launch with hot reload
npm run build    # production build to out/
npm run dist     # package an installer for your OS into release/ (no publishing)
```

## Releasing

Installers are built and published from GitHub Actions, manually — go to the
repo's **Actions** tab → **Release** → **Run workflow**, pick a version bump
(major/minor/patch), and it will:

1. Bump `version` in `package.json` and commit that to `main`.
2. Build + package Windows (`.exe`), macOS (`.dmg`/`.zip`), and Linux
   (`.AppImage`/`.deb`) in parallel, as plain CI artifacts (nothing published yet).
3. Once all three finish, collect every installer and publish one GitHub
   Release with all of them attached.

No local signing/publishing setup needed — the workflow only needs the
repo's built-in `GITHUB_TOKEN`.

## Architecture

Security-conscious IPC split, standard for Electron apps handling credentials:

- **`src/main/`** — the only process that talks to AWS, SSH, the filesystem,
  or an LLM endpoint. Organized by domain:
  - `aws/` — EC2, SSM, and IAM service wrappers (SDK calls only)
  - `agent/` — Agent Mode's request/response handling against the
    user-configured OpenAI-compatible endpoint
  - `ssh/` — the SSM Agent bootstrap script run over a one-off SSH connection
  - `store/` — local JSON persistence for projects, runbooks, instance tags,
    and app-wide settings
  - `vault/` — encrypted AWS credential storage (`safeStorage`)
  - `backup/` — bundles/restores everything above into one password-encrypted
    file for moving to another device (AES-256-GCM, scrypt-derived key —
    plain Node `crypto`, no extra dependency)
  - `ipc/` — one `ipcMain.handle` file per domain, registered from `ipc/index.js`
- **`src/preload/preload.js`** — the only bridge between renderer and main.
  Uses `contextBridge` to expose a fixed `window.api.*` surface over
  `ipcRenderer.invoke` — the renderer never gets raw `ipcRenderer`, so it can't
  reach any channel that isn't explicitly whitelisted here.
- **`src/renderer/`** — the React UI. `contextIsolation` and `sandbox` are
  both on and `nodeIntegration` is off, so this process has no direct access
  to Node, AWS SDKs, or the filesystem — everything goes through `window.api`.
  - `components/` — one component per view/modal (EC2 list, runbook manager,
    agent chat, the SSH bootstrap and tag/variable modals, etc.)
  - `lib/runbookVariables.js` — the `{{variable}}` extraction/substitution
    logic shared by the manual run flow and Agent Mode

## Notes

- Runbooks are arbitrary shell commands — only import ones from sources you
  trust, since they run as-is on your instances.
- An instance must be reachable by AWS Systems Manager (SSM Agent installed
  and running, with an IAM instance profile granting SSM permissions) before
  runbooks can execute against it; the app surfaces this status per instance
  and can fix both prerequisites in one click via "Bootstrap via SSH…".
- Agent Mode's API key is stored encrypted and only ever leaves the machine
  to call the endpoint you configure; the model can only *propose* an action
  (a specific instance id + runbook id), which is always shown back to you
  for explicit confirmation before it actually runs, and any id it invents
  that doesn't match a real instance/runbook is rejected rather than executed.
- Day-to-day, AWS credentials and the Agent Mode API key are encrypted via
  `safeStorage`, which ties its encryption to the current OS user/machine —
  that's why moving to another device needs the explicit backup export/import
  flow (password-based re-encryption) rather than just copying userData files
  over; a raw copy would be silently undecryptable on the new machine.
