# Antarix Chrome Extension

Manifest V3 Chrome extension that tracks focused learning sessions, syncs to the Antarix dashboard, and builds verified skill profiles.

## Development

```bash
pnpm install
pnpm dev          # watch mode — rebuilds on changes
pnpm build        # production build to ./dist
```

## Loading the unpacked extension

1. Run `pnpm build` to produce `dist/`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select `apps/extension/dist/`

## Architecture

```
src/
├── popup/         # User-facing popup UI (React)
├── background/    # Service worker: alarms, focus monitor, sync
├── storage/       # chrome.storage wrappers for sessions
└── lib/           # Supabase client for extension
```

## OAuth

The extension uses the parent web app's Supabase OAuth flow. Users sign in via the web app, and the resulting session tokens are written to `chrome.storage.local` for the extension to consume.
