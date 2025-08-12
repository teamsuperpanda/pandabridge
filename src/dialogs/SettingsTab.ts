import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import PandaBridgePlugin from '../main';
import { DEFAULT_SETTINGS } from '../sync/types';

// Interface to properly type the TextComponent's inputEl property
interface TextComponentWithInput {
  inputEl: HTMLInputElement;
}

export class PandaBridgeSettingTab extends PluginSettingTab {
  plugin: PandaBridgePlugin;
  private connectionResultEl: HTMLElement;

  constructor(app: App, plugin: PandaBridgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Sync Options').setHeading();

    new Setting(containerEl)
      .setName('Use Note-based Deck Organization')
      .setDesc(
        'Create Anki decks based on note location and name. If disabled, uses the default deck below.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useNoteBased).onChange(async (value) => {
          this.plugin.settings.useNoteBased = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Bold question in Reading Mode')
      .setDesc(
        'When enabled, only the question (not the answer) will be bolded in Reading mode; Q:/A: tags are still removed.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.boldQuestionInReadingMode).onChange(async (value) => {
          this.plugin.settings.boldQuestionInReadingMode = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName('Anki Connect').setHeading();

    // Restore defaults button for quick reset
    new Setting(containerEl)
      .setName('Restore defaults')
      .setDesc('Restore Panda Bridge settings to their default values.')
      .addButton((button) =>
        button.setButtonText('Restore Defaults').onClick(async () => {
          this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
          await this.plugin.saveSettings();
          new Notice('Panda Bridge settings restored to defaults');
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('Anki Connect URL')
      .setDesc('The URL where Anki Connect is running.')
      .addText((text) =>
        text
          .setPlaceholder('http://127.0.0.1')
          .setValue(this.plugin.settings.ankiConnectUrl)
          .onChange(async (value) => {
            this.plugin.settings.ankiConnectUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Anki Connect Port')
      .setDesc('The port where Anki Connect is running.')
      .addText((text) =>
        text
          .setPlaceholder('8765')
          .setValue(this.plugin.settings.ankiConnectPort.toString())
          .onChange(async (value) => {
            this.plugin.settings.ankiConnectPort = parseInt(value) || 8765;
            await this.plugin.saveSettings();
          })
      );

    // dynamic description that uses the current deck override word to show an example
    const currentDeckWord =
      this.plugin.settings.deckOverrideWord || DEFAULT_SETTINGS.deckOverrideWord;
    const deckSetting = new Setting(containerEl)
      .setName('Deck override word')
      .setDesc(`Example: ${currentDeckWord}::MyDeck`)
      .addText((text) => {
        text
          .setPlaceholder('Deck')
          .setValue(this.plugin.settings.deckOverrideWord)
          // allow the user to clear the field; we'll enforce defaults on blur
          .onChange(async (value) => {
            this.plugin.settings.deckOverrideWord = value;
            await this.plugin.saveSettings();
            const w = (value && value.trim()) || DEFAULT_SETTINGS.deckOverrideWord;
            if (deckSetting.descEl) deckSetting.descEl.textContent = `Example: ${w}::MyDeck`;
          });

        // restore default if left empty on blur and notify the user
        const inputEl = (text as TextComponentWithInput).inputEl;
        inputEl.addEventListener('blur', async () => {
          if (!inputEl.value || !inputEl.value.trim()) {
            const def = DEFAULT_SETTINGS.deckOverrideWord;
            text.setValue(def);
            this.plugin.settings.deckOverrideWord = def;
            await this.plugin.saveSettings();
            if (deckSetting.descEl) deckSetting.descEl.textContent = `Example: ${def}::MyDeck`;
            new Notice('Deck override word cannot be empty — restored to default');
          }
        });
      });

    const currentQ = this.plugin.settings.questionWord || DEFAULT_SETTINGS.questionWord;
    const questionSetting = new Setting(containerEl)
      .setName('Question word')
      .setDesc(`Example: ${currentQ}: What is the capital of France?`)
      .addText((text) => {
        text
          .setPlaceholder('Q')
          .setValue(this.plugin.settings.questionWord)
          // allow clearing; enforce default on blur
          .onChange(async (value) => {
            // save the raw value (can be empty temporarily)
            this.plugin.settings.questionWord = value;
            await this.plugin.saveSettings();
            const w = (value && value.trim()) || DEFAULT_SETTINGS.questionWord;
            if (questionSetting.descEl)
              questionSetting.descEl.textContent = `Example: ${w}: What is the capital of France?`;
          });

        const inputEl = (text as TextComponentWithInput).inputEl;
        inputEl.addEventListener('blur', async () => {
          if (!inputEl.value || !inputEl.value.trim()) {
            const def = DEFAULT_SETTINGS.questionWord;
            text.setValue(def);
            this.plugin.settings.questionWord = def;
            await this.plugin.saveSettings();
            if (questionSetting.descEl)
              questionSetting.descEl.textContent = `Example: ${def}: What is the capital of France?`;
            new Notice('Question word cannot be empty — restored to default');
          }
        });
      });

    const currentA = this.plugin.settings.answerWord || DEFAULT_SETTINGS.answerWord;
    const answerSetting = new Setting(containerEl)
      .setName('Answer word')
      .setDesc(`Example: ${currentA}: Paris`)
      .addText((text) => {
        text
          .setPlaceholder('A')
          .setValue(this.plugin.settings.answerWord)
          // allow clearing; enforce default on blur
          .onChange(async (value) => {
            this.plugin.settings.answerWord = value;
            await this.plugin.saveSettings();
            const w = (value && value.trim()) || DEFAULT_SETTINGS.answerWord;
            if (answerSetting.descEl) answerSetting.descEl.textContent = `Example: ${w}: Paris`;
          });

        const inputEl = (text as TextComponentWithInput).inputEl;
        inputEl.addEventListener('blur', async () => {
          if (!inputEl.value || !inputEl.value.trim()) {
            const def = DEFAULT_SETTINGS.answerWord;
            text.setValue(def);
            this.plugin.settings.answerWord = def;
            await this.plugin.saveSettings();
            if (answerSetting.descEl) answerSetting.descEl.textContent = `Example: ${def}: Paris`;
            new Notice('Answer word cannot be empty — restored to default');
          }
        });
      });

    new Setting(containerEl)
      .setName('Test Anki Connection')
      .setDesc('Test the connection to Anki Connect.')
      .addButton((button) =>
        button.setButtonText('Test Connection').onClick(async () => {
          await this.testConnection();
        })
      );
    this.connectionResultEl = containerEl.createDiv('panda-bridge-connection-result');
  }

  private async testConnection(): Promise<void> {
    this.connectionResultEl.empty();

    this.connectionResultEl.className = 'panda-bridge-connection-result loading';
    const loadingEl = this.connectionResultEl.createDiv('connection-content');
    loadingEl.createEl('span', { cls: 'connection-icon', text: '⏳' });
    loadingEl.createEl('span', { cls: 'connection-text', text: 'Testing connection...' });

    try {
      const isConnected = await this.plugin.testAnkiConnection();
      this.connectionResultEl.empty();
      if (isConnected) {
        this.connectionResultEl.className = 'panda-bridge-connection-result connected';
        const connectedEl = this.connectionResultEl.createDiv('connection-content');
        connectedEl.createEl('span', { cls: 'connection-icon', text: '✅ ' });
        connectedEl.createEl('span', { cls: 'connection-text', text: 'Connected to Anki Connect' });
        connectedEl.createEl('span', {
          cls: 'connection-details',
          text: `${this.plugin.settings.ankiConnectUrl}:${this.plugin.settings.ankiConnectPort}`,
        });
      } else {
        this.connectionResultEl.className = 'panda-bridge-connection-result disconnected';
        const disconnectedEl = this.connectionResultEl.createDiv('connection-content');
        disconnectedEl.createEl('span', { cls: 'connection-icon', text: '❌ ' });
        disconnectedEl.createEl('span', {
          cls: 'connection-text',
          text: 'Cannot connect to Anki Connect',
        });
        disconnectedEl.createEl('span', {
          cls: 'connection-details',
          text: 'Make sure Anki is running with AnkiConnect addon installed',
        });
      }
    } catch (error) {
      this.connectionResultEl.empty();
      this.connectionResultEl.className = 'panda-bridge-connection-result error';
      const errorEl = this.connectionResultEl.createDiv('connection-content');
      errorEl.createEl('span', { cls: 'connection-icon', text: '⚠️ ' });
      errorEl.createEl('span', { cls: 'connection-text', text: 'Connection error' });
      errorEl.createEl('span', { cls: 'connection-details', text: error.message });
    }
  }
}
