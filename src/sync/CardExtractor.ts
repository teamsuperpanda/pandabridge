import { App, MarkdownView, Notice } from 'obsidian';
import { AnkiCard, PandaBridgeSettings } from './types';
import { extractQACardsFromText } from './extractionUtils';
import { CSS_CLASSES } from '../constants';

export class CardExtractor {
  private app: App;
  private settings: PandaBridgeSettings;

  constructor(app: App, settings: PandaBridgeSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Extracts Q&A cards from the current active note
   * @returns Promise<AnkiCard[]> Array of extracted cards
   * @throws Error if no active note is found
   */
  async extractCardsFromCurrentNote(): Promise<AnkiCard[]> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('No active note found');
      return [];
    }

    try {
      const content = activeView.editor.getValue();
      return extractQACardsFromText(content, this.settings);
    } catch (error) {
      console.error('Error extracting cards from current note:', error);
      new Notice('Error extracting cards from note');
      return [];
    }
  }

  /**
   * Creates regex patterns for Q&A detection
   */
  private createQARegex(escQ: string, escA: string): RegExp {
    return new RegExp(`([*_]{0,2})${escQ}\\s*|([*_]{0,2})${escA}\\s*`, 'gi');
  }

  processQACards(element: HTMLElement, plugin?: any) {
    const containers = element.querySelectorAll('p, div, span, li');

    containers.forEach((container) => {
      if ((container as HTMLElement).classList.contains(CSS_CLASSES.QA_PROCESSED)) {
        return;
      }

      const fullText = container.textContent || '';
      const qTag = plugin?.settings?.questionWord ?? this.settings.questionWord;
      const aTag = plugin?.settings?.answerWord ?? this.settings.answerWord;
      const escQ = qTag.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ':';
      const escA = aTag.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ':';

      if (
        !new RegExp(`[*_]{0,2}${escQ}`).test(fullText) &&
        !new RegExp(`[*_]{0,2}${escA}`).test(fullText)
      ) {
        return;
      }

      const isInCode = (n: Node): boolean => {
        if (!(n instanceof HTMLElement) && !(n instanceof Text)) return false;
        const el = n instanceof Text ? n.parentElement : (n as HTMLElement);
        return !!el?.closest('code, pre');
      };

      const boldQuestion = plugin?.settings?.boldQuestionInReadingMode ?? true;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const toUpdate: Text[] = [];
      let node = walker.nextNode();
      while (node) {
        const textNode = node as Text;
        if (!isInCode(textNode)) {
          const t = textNode.nodeValue ?? '';
          if (/(?:[*_]{0,2})Q:|(?:[*_]{0,2})A:/i.test(t)) {
            toUpdate.push(textNode);
          }
        }
        node = walker.nextNode();
      }

      if (toUpdate.length === 0) {
        return;
      }

      let changed = false;
      let inQuestion = false;

      const applyTransform = (tn: Text) => {
        const text = tn.nodeValue ?? '';
        const frag = document.createDocumentFragment();

        const appendSegment = (segment: string, question: boolean) => {
          if (!segment) return;
          if (boldQuestion && question) {
            const strong = document.createElement('strong');
            strong.textContent = segment;
            frag.appendChild(strong);
          } else {
            frag.appendChild(document.createTextNode(segment));
          }
        };

        const qaRegex = this.createQARegex(escQ, escA);
        let lastIndex = 0;
        let match;
        while ((match = qaRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            appendSegment(text.slice(lastIndex, match.index), inQuestion);
          }

          if (match[0].toUpperCase().includes('Q:')) {
            inQuestion = true;
          } else if (match[0].toUpperCase().includes('A:')) {
            inQuestion = false;
          }
          lastIndex = qaRegex.lastIndex;
        }

        if (lastIndex < text.length) {
          appendSegment(text.slice(lastIndex), inQuestion);
        }

        if (frag.childNodes.length > 0 && frag.textContent !== text) {
          tn.replaceWith(frag);
          changed = true;
        }
      };

      for (const tn of toUpdate) {
        applyTransform(tn);
      }

      if (changed) {
        (container as HTMLElement).classList.add(CSS_CLASSES.QA_PROCESSED);
      }
    });
  }
}
