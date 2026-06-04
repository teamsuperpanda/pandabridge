# ⚡ Panda Zap

<p>
  <img src="https://img.shields.io/badge/version-1.0.2-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/status-stable-brightgreen?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/desktop--only-8B5CF6?style=flat-square" alt="Desktop Only">
</p>

Turn Obsidian notes into Anki flashcards. Panda Zap extracts Q/A pairs from Markdown and syncs them to Anki via AnkiConnect - with full preview of adds, updates, and deletions before anything touches your collection.

> Desktop only. Requires Anki + AnkiConnect.

---

## Features

| | |
|---|---|
| **Q/A Extraction** | Simple, configurable labels (`Q:` / `A:`). Bold/italic around labels is stripped automatically. |
| **Preview before sync** | See exactly what will be added, updated, or removed. |
| **Deck targeting** | Per‑note `Deck::my/deck` override > folder‑based (`folder::NoteName`) > global default deck. Multiple files can share the same deck - cards merge safely. |
| **Basic card model** | Creates and updates Basic (Front / Back) notes. Works with any model exposing `Front` and `Back`. |
| **Connection test** | Quick status check in the sync dialog. |

---

## Requirements

- **Obsidian** - desktop app
- **Anki** - desktop app
- **AnkiConnect** - [add-on 2055492159](https://ankiweb.net/shared/info/2055492159)

---

## Quick start

1. Install **Anki** and **AnkiConnect**, then keep Anki running.
2. Install and enable **Panda Zap** in Obsidian.
3. In a note, write cards using Q/A:

   ```markdown
   Q: What is the capital of France? A: Paris
   Q: What year did World War II end? A: 1945
   ```

4. Click the ⚡ **Zap** ribbon icon to open the sync dialog, review the preview, and sync.

> Preview and full analysis rely on a working AnkiConnect connection. Keep Anki running for accurate add/update/delete suggestions.

---

## Writing cards

**Model** - Basic only (uses `Front` and `Back` fields). Cloze and other types are not supported.

**Labels** - Case‑insensitive, must be followed by a colon: `Q:` / `A:`.

| Format | Example |
|---|---|
| Single‑line | `Q: question A: answer` |
| Images | `I: [[image.png]]` or `I: ![Alt](image.png)` - attached to the Answer field. |
| Formatting | Bold/italic around labels (`*Q:*`, `_A:_`) is stripped. |
| Multi‑line | Bullet lists, tables, steps - any content after `Q:` is the answer. |
| Deck override | `Deck::my/deck` on the first line - highest priority. Overrides folder‑based naming and the default deck. Slashes → Anki `::`. |

> Avoid Q/A inside fenced code blocks or YAML frontmatter.

More examples: [`docs/writing-cards.md`](docs/writing-cards.md)

---

## How syncing works

1. Plugin extracts Q/A pairs from the active note.
2. It analyses existing Anki notes to decide what to add, update, or remove.
3. Preview all changes in a modal before syncing.
4. The plugin detects cards that were removed from your note and asks to delete them from Anki (with confirmation). Deletions are scoped per‑file: cards from other notes in the same deck are never touched.

> Communication is via AnkiConnect's local HTTP API. Keep Anki open.

---

## Settings

| Setting | Default | Notes |
|---|---|---|
| Anki Connect URL | `http://127.0.0.1` | |
| Anki Connect Port | `8765` | |
| Default Deck | - | Global fallback |
| Note‑based Decks | off | Derives deck from `folder/NoteName.md` |
| Deck Override Word | `Deck` | First‑line prefix |
| Question Word | `Q` | |
| Answer Word | `A` | |
| Note Type | `Basic` | Uses `Front` / `Back` fields |
| Bold Question in Reading Mode | on | Presentation only |

Details: [`docs/settings.md`](docs/settings.md)

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| "Not connected to Anki" | Ensure Anki is open and AnkiConnect is installed. Check host/port. |
| "Duplicate" errors | Note likely already exists. The plugin skips when safe. |
| Missing cards | Confirm Q/A lines aren't inside code blocks or frontmatter. |
| Other issues | Open Obsidian Dev Console (`Ctrl/Cmd+Shift+I`) for error messages. |

If you're stuck, open a GitHub issue with a small repro (a few lines of the note) and any console output.

---

## Privacy & security

Panda Zap communicates with AnkiConnect over HTTP (`http://127.0.0.1:8765` by default). See [`PRIVACY.md`](PRIVACY.md) for full details.

Data transmitted to the configured AnkiConnect host:
- Full note content (for analysis and sync)
- Note path / filename (with note‑based decks)
- Card fields (`Front`, `Back`) and target deck/model names

By default the plugin connects to **localhost only**. If pointing to a remote host, secure the transport (SSH tunnel, VPN). This plugin collects **no telemetry**.

---

## License

PolyForm Noncommercial 1.0.0 - see [`LICENSE`](LICENSE). Free for hobby, personal, educational, and noncommercial use. Commercial use, rebranding, or resale is not permitted.

Developer notes and extended examples: [`docs/`](docs/).
