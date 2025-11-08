import { AnkiCard, PandaBridgeSettings, SyncAnalysis, CardAction, CardSyncInfo } from './types';
import { ANKI_CONNECT_VERSION, DEFAULT_TIMEOUT_MS, PLUGIN_TAG } from '../constants';

export class AnkiConnector {
  private settings: PandaBridgeSettings;
  // Simple cache for notes info per-deck to avoid per-card findNotes calls
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private noteCache: { deckName: string; byFront: Map<string, any>; noteIds: string[] } | null =
    null;

  constructor(settings: PandaBridgeSettings) {
    this.settings = settings;
  }

  /**
   * Tests connection to Anki Connect
   * @returns Promise<boolean> True if connection successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.ankiConnectRequest('version', ANKI_CONNECT_VERSION);
      return response !== null;
    } catch {
      return false;
    }
  }

  /**
   * Analyzes what sync operations need to be performed
   * @param cards Array of cards to analyze
   * @param notePath Optional path to the note file
   * @param noteContent Optional content of the note
   * @returns Promise<SyncAnalysis> Analysis of required operations
   */
  async analyzeSyncOperation(
    cards: AnkiCard[],
    notePath?: string,
    noteContent?: string
  ): Promise<SyncAnalysis> {
    const analysis: SyncAnalysis = {
      cardsToAdd: [],
      cardsToUpdate: [],
      cardsToDelete: [],
      totalCards: cards.length,
    };

    if (!(await this.testConnection())) {
      throw new Error(
        'Cannot connect to Anki Connect. Make sure Anki is running with AnkiConnect addon installed.'
      );
    }

    const deckName = this.getDeckName(notePath, noteContent);

    for (const card of cards) {
      try {
        const existingCardId = await this.findExistingCard(card, deckName);

        if (existingCardId) {
          // Fetch note info to compare fields — only mark for update if Front or Back changed
          try {
            const info = await this.ankiConnectRequest('notesInfo', ANKI_CONNECT_VERSION, {
              notes: [existingCardId],
            });
            const ni = info && info[0];
            const front = (ni?.fields?.Front?.value || '').trim();
            const back = (ni?.fields?.Back?.value || '').trim();
            const qTrim = (card.question || '').trim();
            const aTrim = (card.answer || '').trim();
            if (front === qTrim && back === aTrim) {
              // No change — skip
              continue;
            } else {
              const cardSyncInfo: CardSyncInfo = {
                card,
                action: CardAction.UPDATE,
                deckName,
                existingCardId,
              };
              analysis.cardsToUpdate.push(cardSyncInfo);
            }
          } catch {
            // If we can't fetch note info, be conservative and schedule an update
            const cardSyncInfo: CardSyncInfo = {
              card,
              action: CardAction.UPDATE,
              deckName,
              existingCardId,
            };
            analysis.cardsToUpdate.push(cardSyncInfo);
          }
        } else {
          analysis.cardsToAdd.push({ card, action: CardAction.ADD, deckName });
        }
      } catch {
        // Silently skip cards with analysis errors
        analysis.cardsToAdd.push({
          card,
          action: CardAction.ADD,
          deckName,
        });
      }
    }

    // If using note-based decks, detect Anki notes that were previously created from this note
    // but are no longer present in the current note and mark them for deletion.
    try {
      if (this.settings.useNoteBased && notePath) {
        // Find notes in the target deck that have the plugin tag
        const query = `deck:"${deckName}" tag:${PLUGIN_TAG}`;
        const existingNoteIds: string[] = await this.ankiConnectRequest(
          'findNotes',
          ANKI_CONNECT_VERSION,
          { query }
        );
        if (existingNoteIds && existingNoteIds.length > 0) {
          // Fetch note info to read Front/Back fields
          const notesInfo = await this.ankiConnectRequest('notesInfo', ANKI_CONNECT_VERSION, {
            notes: existingNoteIds,
          });
          // Build a set of extracted questions for quick lookup (normalized)
          const extractedQuestions = new Set(cards.map((c) => (c.question || '').trim()));

          for (const ni of notesInfo) {
            try {
              const front =
                ni.fields && ni.fields.Front && ni.fields.Front.value
                  ? ni.fields.Front.value.trim()
                  : '';
              const back =
                ni.fields && ni.fields.Back && ni.fields.Back.value
                  ? ni.fields.Back.value.trim()
                  : '';
              if (front && !extractedQuestions.has(front)) {
                // This card exists in Anki but not in the current note — schedule for deletion
                const delCard = { question: front, answer: back, line: -1 };
                const cs: CardSyncInfo = {
                  card: delCard,
                  action: CardAction.DELETE,
                  deckName,
                  existingCardId: ni.noteId || ni.noteIds?.[0] || ni.id || ni.noteId,
                };
                analysis.cardsToDelete.push(cs);
              }
            } catch (inner) {
              // ignore per-note errors
              console.warn('Error processing notesInfo entry for deletion check', inner);
            }
          }
        }
      }
    } catch (err) {
      // Non-fatal: if deletion detection fails, continue without marking deletions
      console.warn('Deletion detection failed:', err);
    }

    return analysis;
  }

  private async findExistingCard(card: AnkiCard, deckName: string): Promise<string | null> {
    try {
      // Ensure deck notes are prefetched and cached
      await this.prefetchNotesForDeck(deckName);
      if (this.noteCache && this.noteCache.byFront) {
        const key = this.normalizeField(card.question || '');
        const entry = this.noteCache.byFront.get(key);
        if (entry) return entry.noteId || entry.id || null;
      }
      return null;
    } catch (error) {
      console.log('Could not find existing card (cached):', error);
      return null;
    }
  }

  async syncCards(
    cards: AnkiCard[],
    preview: boolean = false,
    notePath?: string,
    noteContent?: string,
    deleteConfirmed: boolean = false
  ): Promise<string[]> {
    if (!(await this.testConnection())) {
      throw new Error(
        'Cannot connect to Anki Connect. Make sure Anki is running with AnkiConnect addon installed.'
      );
    }

    const results: string[] = [];
    const deckName = this.getDeckName(notePath, noteContent);

    if (this.settings.useNoteBased && notePath && !preview) {
      try {
        await this.ankiConnectRequest('createDeck', 6, {
          deck: deckName,
        });
      } catch {
        // ignore deck creation errors
      }
    }

    for (const card of cards) {
      try {
        if (preview) {
          const targetDeck =
            this.settings.useNoteBased && notePath ? deckName : this.settings.defaultDeck;
          const qTag = `${this.settings.questionWord}:`;
          const aTag = `${this.settings.answerWord}:`;
          results.push(
            `Preview: ${qTag} ${card.question} | ${aTag} ${card.answer} | Deck: ${targetDeck}`
          );
        } else {
          const updated = await this.updateExistingCard(card, deckName);
          if (updated) {
            results.push(`🔄 Updated: ${card.question} → ${deckName}`);
          } else {
            try {
              await this.ankiConnectRequest('addNote', 6, {
                note: {
                  deckName: deckName,
                  modelName: this.settings.noteType,
                  fields: {
                    Front: card.question,
                    Back: card.answer,
                  },
                  tags: ['panda-bridge', 'obsidian'],
                },
              });
              results.push(`✅ Added: ${card.question} → ${deckName}`);
            } catch (err) {
              // If Anki reports the note is a duplicate, treat it as a skip (card already exists)
              const msg = err && err.message ? String(err.message).toLowerCase() : '';
              if (msg.includes('duplicate') || msg.includes('cannot create note')) {
                results.push(`ℹ️ Skipped (already exists): ${card.question} → ${deckName}`);
              } else {
                throw err;
              }
            }
          }
        }
      } catch (error) {
        results.push(`❌ Failed: ${card.question} - ${error.message}`);
      }
    }

    // If deletions are requested (only applicable for note-based decks), and user confirmed them,
    // find deletions via analyzeSyncOperation and delete the notes.
    if (!preview && deleteConfirmed && this.settings.useNoteBased && notePath) {
      try {
        const analysis = await this.analyzeSyncOperation(cards, notePath, noteContent);
        const toDelete = analysis.cardsToDelete
          .map((d) => d.existingCardId)
          .filter(Boolean) as string[];
        if (toDelete.length > 0) {
          // Call AnkiConnect deleteNotes
          await this.ankiConnectRequest('deleteNotes', 6, { notes: toDelete });
          results.push(`🗑️ Deleted ${toDelete.length} notes from Anki`);
        }
      } catch (err) {
        console.warn('Failed to delete notes during sync', err);
        results.push(`❌ Failed to delete notes: ${err.message}`);
      }
    }

    return results;
  }

  private async updateExistingCard(card: AnkiCard, deckName: string): Promise<boolean> {
    try {
      // Use cached notes when available to avoid extra network calls
      await this.prefetchNotesForDeck(deckName);
      let noteId: string | undefined;
      if (this.noteCache && this.noteCache.byFront) {
        const key = this.normalizeField(card.question || '');
        const entry = this.noteCache.byFront.get(key);
        noteId = entry && (entry.noteId || entry.id);
      }

      if (noteId) {
        // Use cached fields if available to avoid notesInfo call
        const cached = this.noteCache?.byFront.get(this.normalizeField(card.question || ''));
        try {
          const front = (cached?.fields?.Front?.value || cached?.fields?.Front || '')
            .toString()
            .trim();
          const back = (cached?.fields?.Back?.value || cached?.fields?.Back || '')
            .toString()
            .trim();
          const qTrim = (card.question || '').trim();
          const aTrim = (card.answer || '').trim();
          if (front === qTrim && back === aTrim) {
            return false;
          }
        } catch {
          // If we can't read cached info, fallthrough and attempt update conservatively
        }

        await this.ankiConnectRequest('updateNoteFields', 6, {
          note: {
            id: noteId,
            fields: {
              Front: card.question,
              Back: card.answer,
            },
          },
        });
        // Invalidate cache if present since we changed a note
        this.noteCache = null;
        return true;
      }

      return false;
    } catch (error) {
      console.log('Could not update existing card:', error);
      return false;
    }
  }

  private normalizeField(s: string): string {
    return (s || '').toString().trim();
  }

  private async prefetchNotesForDeck(deckName: string): Promise<void> {
    // If cache is already for this deck, return
    if (this.noteCache && this.noteCache.deckName === deckName) return;
    this.noteCache = { deckName, byFront: new Map(), noteIds: [] };

    try {
      // Prefer plugin-tagged notes to avoid scanning entire deck
      const query = `deck:"${deckName}" tag:${PLUGIN_TAG}`;
      let noteIds: string[] = [];
      try {
        noteIds = await this.ankiConnectRequest('findNotes', 6, { query });
      } catch {
        // ignore and try deck-only
      }

      if (!noteIds || noteIds.length === 0) {
        // Fallback to deck-only query
        try {
          noteIds = await this.ankiConnectRequest('findNotes', 6, { query: `deck:"${deckName}"` });
        } catch {
          noteIds = [];
        }
      }

      if (!noteIds || noteIds.length === 0) return;

      const notesInfo = await this.ankiConnectRequest('notesInfo', 6, { notes: noteIds });
      if (!notesInfo || !Array.isArray(notesInfo)) return;

      for (const ni of notesInfo) {
        try {
          const front =
            ni.fields && ni.fields.Front && (ni.fields.Front.value ?? ni.fields.Front)
              ? (ni.fields.Front.value ?? ni.fields.Front).toString().trim()
              : '';
          const key = this.normalizeField(front);
          const id = ni.noteId || ni.noteIds?.[0] || ni.id;
          this.noteCache?.noteIds.push(id);
          this.noteCache?.byFront.set(key, { noteId: id, fields: ni.fields, raw: ni });
        } catch {
          // ignore individual failures
        }
      }
    } catch {
      // On any failure, clear cache
      this.noteCache = null;
    }
  }

  private getDeckName(notePath?: string, noteContent?: string): string {
    // Allow a Deck:: override on the first line of the note regardless of "useNoteBased".
    if (noteContent && this.settings.deckOverrideWord) {
      const firstLine = noteContent.split(/\r?\n/)[0] || '';
      // Escape word for safe regex use and require the literal '::' after it
      const esc = this.settings.deckOverrideWord.replace(/[.*+?^${}(|[\]\\]/g, '\\$&');
      const prefRegex = new RegExp(`^${esc}::\\s*(.+)$`, 'i');
      const m = firstLine.match(prefRegex);
      if (m && m[1]) {
        // Normalize any '/' to Anki's '::' nested-deck separator
        return m[1].trim().replace(/\//g, '::');
      }
    }

    if (!this.settings.useNoteBased || !notePath) {
      return this.settings.defaultDeck;
    }

    const pathParts = notePath.split('/');
    const noteNameWithExt = pathParts.pop() || 'Unknown';
    const noteName = noteNameWithExt.replace(/\.md$/, '');
    const folderPath = pathParts.length > 0 ? pathParts.join('/') : '';

    if (folderPath) {
      return `${folderPath}::${noteName}`;
    } else {
      return noteName;
    }
  }
  private buildAnkiConnectUrl(): string {
    // Normalize URL + port. settings.ankiConnectUrl may include protocol and/or port.
    try {
      const maybeUrl = String(this.settings.ankiConnectUrl || 'http://127.0.0.1');
      let u: URL;
      try {
        u = new URL(maybeUrl);
      } catch {
        // If the URL is missing protocol, prepend http://
        u = new URL(`http://${maybeUrl}`);
      }
      if ((!u.port || u.port === '') && this.settings.ankiConnectPort) {
        u.port = String(this.settings.ankiConnectPort);
      }
      return u.toString();
    } catch {
      // Fallback
      return `http://127.0.0.1:${this.settings.ankiConnectPort || 8765}`;
    }
  }

  private async fetchWithTimeout(
    input: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    init: any = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async ankiConnectRequest(action: string, version: number, params?: any): Promise<any> {
    const baseUrl = this.buildAnkiConnectUrl();
    const payload = JSON.stringify({ action, version, params });
    const url = baseUrl; // POSTing to the base URL

    const MAX_RETRIES = 2;
    const BASE_TIMEOUT = 5000; // ms

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const timeout = BASE_TIMEOUT * Math.pow(2, attempt); // exponential backoff for timeout
        const response = await this.fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          },
          timeout
        );

        if (!response.ok) {
          // Retry on server errors
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            const backoff = 200 * Math.pow(2, attempt);
            await this.sleep(backoff + Math.random() * 100);
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        return data.result;
      } catch (error) {
        // error type could be any - necessary for catching network errors
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isAbort = (error as any).name === 'AbortError' || (error as any).type === 'aborted';
        const isNetwork =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any).name === 'TypeError' || (error as any).message === 'Failed to fetch';
        const shouldRetry = (isAbort || isNetwork) && attempt < MAX_RETRIES;
        if (shouldRetry) {
          const backoff = 200 * Math.pow(2, attempt);
          await this.sleep(backoff + Math.random() * 150);
          continue;
        }
        throw error;
      }
    }
  }
}
