# True Recall

**The next-gen spaced repetition system for Obsidian.**

Create flashcards inside your notes, review them with FSRS v6 scheduling, and track progress with comprehensive analytics — all without leaving Obsidian.

[Documentation](https://www.truerecall.app/) · [Pricing](https://www.truerecall.app/pricing/)

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

## License

Source-available under the [True Recall Source-Available License 1.0](LICENSE)
(SPDX: `LicenseRef-True-Recall-Source-Available-1.0`).

Permitted: personal, non-commercial use; reading and studying the source;
local modifications for your own use; submitting contributions upstream.

Not permitted without prior written permission: redistribution, commercial use,
hosting as a service, or building a competing product. For commercial licensing,
contact `pieralukasz@gmail.com`.
