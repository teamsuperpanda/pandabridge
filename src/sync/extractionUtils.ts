import { AnkiCard, PandaBridgeSettings } from './types';

/**
 * Extracts Q&A cards from text content
 * @param content The text content to extract cards from
 * @param settings Plugin settings containing question/answer words
 * @returns Array of extracted AnkiCard objects
 */
export function extractQACardsFromText(content: string, settings: PandaBridgeSettings): AnkiCard[] {
  if (!content || !settings) {
    return [];
  }

  const cards: AnkiCard[] = [];
  const lines = content.split('\n');

  try {
    const escQWord = settings.questionWord.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const escAWord = settings.answerWord.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const escQ = `${escQWord}:`;
    const escA = `${escAWord}:`;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Try to match Q: ... A: ... on same line
      const qaRegex = new RegExp(
        `(?:[*_]{0,2})${escQ}\\s*(.+?)\\s*(?:[*_]{0,2})${escA}\\s*(.+)`,
        'i'
      );
      const qaMatch = line.match(qaRegex);
      if (qaMatch) {
        cards.push({
          question: qaMatch[1].replace(/[*_]+/g, '').trim(),
          answer: qaMatch[2].replace(/[*_]+/g, '').trim(),
          line: i + 1,
        });
        continue;
      }

      // Try to match Q: on one line, A: on next line(s)
      const qRegex = new RegExp(`^(?:[*_]{0,2})${escQ}\\s*(.+)`, 'i');
      const qMatch = line.match(qRegex);
      if (qMatch && i + 1 < lines.length) {
        let aLine = lines[i + 1];
        const aRegex = new RegExp(`^(?:[*_]{0,2})${escA}\\s*(.*)`, 'i');
        const aMatch = aLine.match(aRegex);
        if (aMatch !== null) {
          let answerLines = [aMatch[1]];
          let j = i + 2;
          while (j < lines.length) {
            const next = lines[j];
            if (
              next.trim() === '' ||
              new RegExp(`^(?:[*_]{0,2})${escQ}\\s*`, 'i').test(next) ||
              new RegExp(`^(?:[*_]{0,2})${escA}\\s*`, 'i').test(next)
            ) {
              break;
            }
            answerLines.push(next);
            j++;
          }
          cards.push({
            question: qMatch[1].replace(/[*_]+/g, '').trim(),
            answer: answerLines.join('\n').trim(),
            line: i + 1,
          });
          i = j - 1;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting cards from text:', error);
    return [];
  }

  return cards;
}

export default extractQACardsFromText;