---
description: Start the development environment with vault hot-reload
---

Start the development environment with vault hot-reload.

## Steps

1. Check if the VAULT environment variable is set. If not, ask the user for their Obsidian vault path (e.g., `/Users/lukaszpiera/Library/Mobile Documents/iCloud~md~obsidian/Documents/My Life`).
2. Export the VAULT variable for the session.
3. Run `bun dev` in the background — this starts esbuild in watch mode + Tailwind CSS compilation + vault copying.
4. Confirm dev mode is running and hot-reload is active.
5. Remind the user to enable the plugin in Obsidian and use Ctrl+R to reload after changes.
