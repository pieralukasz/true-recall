# True Recall

**The next-gen spaced repetition system for Obsidian.**

Create flashcards inside your notes, review them with FSRS v6 scheduling, and track progress with comprehensive analytics — all without leaving Obsidian.

[Documentation](https://www.truerecall.app/) · [Pricing](https://www.truerecall.app/pricing/) · [Sponsor on GitHub](https://github.com/sponsors/pieralukasz)

---

![Dashboard](assets/dashboard.png)
![Statistics](assets/statistics.png)
![Flashcards](assets/flashcards.png)
![Review](assets/review.png)

---

## Features

- **FSRS v6 Algorithm** — State-of-the-art spaced repetition with 21 trainable parameters. Optimizes to your personal memory patterns after 400+ reviews.
- **AI Card Generation** — Select text, get instant flashcards. Supports Basic, Cloze, Reversed, and Image Occlusion card types. Multiple models via OpenRouter (Gemini, GPT, Claude, Llama).
- **Local-First Storage** — All data in a portable SQLite database inside your vault (`.true-recall/true-recall.db`). Your data stays with you.
- **Projects System** — Organize cards across notes with many-to-many relationships. Review by topic, inherit FSRS presets from parent projects.
- **Anki Compatible** — Import `.apkg` decks and export to Anki or CSV/TSV.
- **Analytics & Widgets** — Dashboard, statistics, calendar heatmap, forecast charts, and 25+ inline codeblock widgets you can embed in any note.
- **Card Browser** — Powerful query syntax for finding cards by state, properties, source note, and more.
- **Type-in Mode** — Type answers with AI semantic grading or diff-based checking.

---

## Installation

### Via BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. Settings → BRAT → Add Beta Plugin → enter `pieralukasz/true-recall`
3. Enable True Recall in Settings → Community plugins

### Manual

1. Download the latest release from [GitHub Releases](https://github.com/pieralukasz/true-recall/releases)
2. Copy `main.js`, `styles.css`, and `manifest.json` into `<your-vault>/.obsidian/plugins/true-recall/`
3. Enable the plugin in Settings → Community plugins

### From Source

```bash
git clone https://github.com/pieralukasz/true-recall.git
cd true-recall
bun install
bun run build
cp main.js styles.css manifest.json <your-vault>/.obsidian/plugins/true-recall/
```

### Requirements

- Obsidian 1.7.2+
- Desktop (Windows, macOS, Linux) and Mobile (iOS, Android)

---

## Quick Start

1. **Open a note** and select some text
2. **Use the selection toolbar** to generate flashcards with AI
3. **Open the Flashcard Panel** to see and collect your cards
4. **Start a review session** — rate cards as Again, Hard, Good, or Easy
5. **Track progress** in the Statistics view or embed widgets in your notes

For a complete walkthrough, see the [documentation](https://www.truerecall.app/).

---

## Privacy & Background Activity

True Recall is local-first. No telemetry, analytics, or background data transmission.

**Periodic timers (`setInterval`) — all local, no network:**
- Database safety-flush — writes pending changes to the local SQLite file in your vault.
- Optional background backup — writes a backup file inside your vault when enabled in settings.
- Device-lock heartbeat — updates a small lock file inside your vault to prevent two Obsidian Sync clients from corrupting the database when both are open. Local file write only.
- UI status polling — reads in-memory state to refresh diagnostics/backup panels.

**Network requests — only on explicit user action or one-time per release:**
- Update check — when the plugin version differs from the last seen version, a single `requestUrl` call is made to the GitHub Releases API to fetch release notes. Runs once per version, not on a timer.
- AI / RAG features (opt-in) — flashcard generation, semantic grading, and RAG are disabled by default. When enabled, requests go only to the LLM provider you configure (OpenRouter, your local Ollama, etc.). No third-party server is involved.
- Local API server (desktop, opt-in) — binds to `127.0.0.1` only, used by the optional companion CLI. Never reaches the public network and is disabled by default.

**Storage:** All flashcards and review data live in `.true-recall/true-recall.db` inside your vault. Backups and lock files live in the same `.true-recall/` folder. Nothing is uploaded anywhere.

---

## License

Source-available under the [PolyForm Strict License 1.0.0](LICENSE)
(SPDX: `PolyForm-Strict-1.0.0`).

Permitted: noncommercial use, including personal study, research, hobby
projects, and use by charitable / educational / public-research / government
organizations. Fair-use rights are preserved.

Not permitted under this license: redistribution, modification and derivative
works, commercial use, hosting as a service, or building a competing product.

**Commercial licensing.** A separate commercial license is required for any
use beyond what PolyForm Strict allows — including production deployments
inside a business, paid services built on True Recall, or distributing
derivative works. Contact `pieralukasz@gmail.com` to discuss terms.
