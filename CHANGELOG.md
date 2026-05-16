# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-05-16
- Cross-window safety: replaced `instanceof` with `.instanceOf()` across SyncModal and CardExtractor
- Popout window compat: replaced `document.*` with `container.ownerDocument.*` in CardExtractor
- Popout window compat: replaced `setTimeout` with `activeWindow.setTimeout` in AnkiConnector
- Use Obsidian API helpers: `createSpan()` instead of `createEl('span')` in SettingsTab
- CSS: removed `!important` from disabled button style (increased specificity instead)
- Replaced deprecated `builtin-modules` dep with `module.builtinModules`
- Added CONTRIBUTING.md

## [1.0.0] - Initial release
- Initial public release of Panda Zap
- Features:
  - Extract Q/A flashcards from notes using `Q:` / `A:` syntax
  - Preview and sync cards to Anki via AnkiConnect
  - Note-based deck organization and optional deck override
  - Basic duplicate detection and update flow
- Desktop-only (requires Anki + AnkiConnect running locally)

