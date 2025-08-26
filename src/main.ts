import { Plugin, MarkdownView } from 'obsidian';
import { SyncModal } from './dialogs/SyncModal';
import { PandaBridgeSettingTab } from './dialogs/SettingsTab';
import { AnkiConnector } from './sync/AnkiConnector';
import { CardExtractor } from './sync/CardExtractor';
import { PandaBridgeSettings, DEFAULT_SETTINGS, AnkiCard, SyncAnalysis } from './sync/types';
import { CSS_CLASSES } from './constants';

export default class PandaBridgePlugin extends Plugin {
  settings: PandaBridgeSettings;
  private ankiConnector: AnkiConnector;
  private cardExtractor: CardExtractor;

  async onload() {
    await this.loadSettings();

    this.ankiConnector = new AnkiConnector(this.settings);
    this.cardExtractor = new CardExtractor(this.app, this.settings);

    const ribbonIconEl = this.addRibbonIcon(
      '🐼',
      'Panda Bridge - Click to sync cards to Anki',
      () => {
        this.openSyncDialog();
      }
    );
    ribbonIconEl.addClass(CSS_CLASSES.RIBBON);
    ribbonIconEl.textContent = '🐼';
    ribbonIconEl.setAttribute('aria-label', 'Panda Bridge Sync');

    this.addCommand({
      id: 'sync',
      name: 'Open Sync Dialog',
      callback: () => {
        this.openSyncDialog();
      },
    });

    this.addSettingTab(new PandaBridgeSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((element, _context) => {
      this.cardExtractor.processQACards(element, this);
    });

    console.log('🐼 Panda Bridge plugin loaded successfully');
  }

  /**
   * Opens the sync dialog modal
   */
  async openSyncDialog() {
    new SyncModal(this.app, this).open();
  }

  /**
   * Loads plugin settings from data.json
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Saves plugin settings to data.json
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Tests connection to Anki Connect
   * @returns Promise<boolean> True if connection successful
   */
  async testAnkiConnection(): Promise<boolean> {
    // Use a fresh connector created from current settings to ensure we use latest values
    const connector = new AnkiConnector(this.settings);
    return await connector.testConnection();
  }

  /**
   * Analyzes what sync operations need to be performed for the current note
   * @returns Promise<SyncAnalysis> Analysis of required operations
   */
  async analyzeSyncOperation(): Promise<SyncAnalysis> {
    // Recreate connector and extractor using current settings so analysis uses latest values
    this.ankiConnector = new AnkiConnector(this.settings);
    this.cardExtractor = new CardExtractor(this.app, this.settings);

    const cards = await this.extractCardsFromCurrentNote();
    const activeFile = this.app.workspace.getActiveFile();
    const notePath = activeFile ? activeFile.path : undefined;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const noteContent = activeView ? activeView.editor.getValue() : undefined;
    return await this.ankiConnector.analyzeSyncOperation(cards, notePath, noteContent);
  }

  /**
   * Extracts Q&A cards from the current active note
   * @returns Promise<AnkiCard[]> Array of extracted cards
   */
  async extractCardsFromCurrentNote(): Promise<AnkiCard[]> {
    // Recreate extractor to pick up any settings changes
    this.cardExtractor = new CardExtractor(this.app, this.settings);
    return await this.cardExtractor.extractCardsFromCurrentNote();
  }

  /**
   * Syncs cards to Anki
   * @param cards Array of cards to sync
   * @param preview Whether this is a preview operation
   * @param deleteConfirmed Whether delete operations are confirmed
   * @returns Promise<string[]> Array of result messages
   */
  async syncCardsToAnki(
    cards: AnkiCard[],
    preview: boolean = false,
    deleteConfirmed: boolean = false
  ): Promise<string[]> {
    this.ankiConnector = new AnkiConnector(this.settings);
    const activeFile = this.app.workspace.getActiveFile();
    const notePath = activeFile ? activeFile.path : undefined;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const noteContent = activeView ? activeView.editor.getValue() : undefined;
    return await this.ankiConnector.syncCards(
      cards,
      preview,
      notePath,
      noteContent,
      deleteConfirmed
    );
  }
}
