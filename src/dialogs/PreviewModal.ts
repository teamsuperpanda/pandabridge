import { Modal, App } from 'obsidian';
import { SyncAnalysis, CardSyncInfo, PandaBridgeSettings } from '../sync/types';

export class PreviewModal extends Modal {
  private syncAnalysis: SyncAnalysis;
  private settings: PandaBridgeSettings;

  constructor(app: App, syncAnalysis: SyncAnalysis, settings: PandaBridgeSettings) {
    super(app);
    this.syncAnalysis = syncAnalysis;
    this.settings = settings;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('panda-bridge-preview-modal');
    const header = contentEl.createDiv('panda-bridge-preview-header');
    header.createEl('h2', { text: 'Preview Changes' });
    const content = contentEl.createDiv('panda-bridge-preview-content');
    const totalChanges =
      this.syncAnalysis.cardsToAdd.length +
      this.syncAnalysis.cardsToUpdate.length +
      this.syncAnalysis.cardsToDelete.length;
    if (totalChanges === 0) {
      const emptyState = content.createDiv('panda-bridge-empty-state');
      emptyState.createSpan({ text: '✨ No changes needed - all cards are up to date!' });
      return;
    }
    if (this.syncAnalysis.cardsToAdd.length > 0) {
      this.renderSection(content, 'add', '📝 Cards to Add', this.syncAnalysis.cardsToAdd);
    }
    if (this.syncAnalysis.cardsToUpdate.length > 0) {
      this.renderSection(content, 'update', '🔄 Cards to Update', this.syncAnalysis.cardsToUpdate);
    }
    if (this.syncAnalysis.cardsToDelete.length > 0) {
      this.renderSection(content, 'delete', '🗑️ Cards to Remove', this.syncAnalysis.cardsToDelete);
    }
  }

  private renderSection(
    container: HTMLElement,
    type: string,
    title: string,
    cards: CardSyncInfo[]
  ) {
    const section = container.createDiv('panda-bridge-preview-section');
    const sectionHeader = section.createDiv('panda-bridge-section-header');
    const toggleIcon = sectionHeader.createSpan({ cls: 'panda-bridge-toggle-icon expanded' });
    toggleIcon.textContent = '▼';
    sectionHeader.createSpan({
      text: `${title} (${cards.length})`,
      cls: 'panda-bridge-section-title',
    });
    const cardsContainer = section.createDiv('panda-bridge-cards-container expanded');
    sectionHeader.onclick = () => {
      const isExpanded = toggleIcon.classList.contains('expanded');
      if (isExpanded) {
        toggleIcon.classList.remove('expanded');
        toggleIcon.textContent = '▶';
        cardsContainer.classList.remove('expanded');
        cardsContainer.classList.add('collapsed');
      } else {
        toggleIcon.classList.add('expanded');
        toggleIcon.textContent = '▼';
        cardsContainer.classList.remove('collapsed');
        cardsContainer.classList.add('expanded');
      }
    };
    cards.forEach((cardInfo, index) => {
      const cardElement = cardsContainer.createDiv(`panda-bridge-card ${type}`);

      const cardHeader = cardElement.createDiv('panda-bridge-card-header panda-bridge-card-header-stacked');
      cardHeader.createSpan({ text: `Card ${index + 1}`, cls: 'panda-bridge-card-number' });
      cardHeader.createSpan({ text: `Deck: ${cardInfo.deckName}`, cls: 'panda-bridge-card-deck' });

      const cardContent = cardElement.createDiv('panda-bridge-card-content');
      const questionDiv = cardContent.createDiv('panda-bridge-card-question');
      questionDiv.createSpan({
        text: `${this.settings.questionWord}: `,
        cls: 'panda-bridge-card-label',
      });
      questionDiv.createSpan({ text: cardInfo.card.question, cls: 'panda-bridge-card-text' });
      const answerDiv = cardContent.createDiv('panda-bridge-card-answer');
      answerDiv.createSpan({
        text: `${this.settings.answerWord}: `,
        cls: 'panda-bridge-card-label',
      });
      answerDiv.createSpan({ text: cardInfo.card.answer, cls: 'panda-bridge-card-text' });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
