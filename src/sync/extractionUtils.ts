import { AnkiCard, PandaZapSettings } from './types';

/**
 * Parses raw text from an I: field to extract the file path or URL
 * Supports:
 * - Direct path/URL: "folder/image.png" or "https://example.com/img.jpg"
 * - Obsidian link: "![[folder/image.png]]"
 * - Markdown link: "![alt](folder/image.png)"
 */
function parseImagePath(text: string): string | null {
  if (!text) return null;
  let clean = text.trim();

  // Handle Obsidian wiki link: ![[...]] or [[...]]
  const wikiMatch = clean.match(/^!{0,1}\[\[(.*?)\]\]$/);
  if (wikiMatch) {
    clean = wikiMatch[1];
    // Wiki links might have pipe for label: ![[image.png|100]]. Strip |...
    const pipeIndex = clean.lastIndexOf('|');
    if (pipeIndex !== -1) {
      clean = clean.substring(0, pipeIndex);
    }
    return clean.trim();
  }

  // Handle Markdown link: ![...](...)
  const mdMatch = clean.match(/^!\[.*?\]\((.*?)\)$/);
  if (mdMatch) {
    // markdown link url part might include title "path" "title"
    const path = mdMatch[1].split(' ')[0];
    return path.trim();
  }

  // Also check if text contains these patterns but not exact match (inline)
  // For basic support, we assume the I: line IS the link content predominantly.
  const wikiFind = clean.match(/!{0,1}\[\[(.*?)\]\]/);
  if (wikiFind) {
    const inner = wikiFind[1];
    const pipeIndex = inner.lastIndexOf('|');
    return pipeIndex !== -1 ? inner.substring(0, pipeIndex).trim() : inner.trim();
  }

  const mdFind = clean.match(/!\[.*?\]\((.*?)\)/);
  if (mdFind) {
    return mdFind[1].split(' ')[0].trim();
  }

  // Fallback: just return the text as is (direct path/url)
  return clean;
}

/**
 * Converts markdown lists (unordered and ordered) to HTML list elements.
 * Supports nested lists via indentation (tabs or 2-space units).
 */
function convertMarkdownListsToHtml(text: string): string {
  if (!text) return text;
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  function getDepth(indent: string): number {
    if (indent.includes('\t')) return indent.length;
    return indent.length > 0 ? Math.floor(indent.length / 2) : 0;
  }

  function renderNestedList(
    items: { depth: number; isOrdered: boolean; content: string }[],
    startIdx: number,
    parentDepth: number,
  ): { html: string; endIdx: number } {
    if (startIdx >= items.length || items[startIdx].depth <= parentDepth) {
      return { html: '', endIdx: startIdx };
    }

    const type = items[startIdx].isOrdered ? 'ol' : 'ul';
    const parts: string[] = [`<${type}>`];
    let idx = startIdx;

    while (idx < items.length) {
      const item = items[idx];
      if (item.depth <= parentDepth) break;

      if (item.depth === parentDepth + 1) {
        let nestedHtml = '';
        if (idx + 1 < items.length && items[idx + 1].depth > item.depth) {
          const nested = renderNestedList(items, idx + 1, item.depth);
          nestedHtml = nested.html;
          idx = nested.endIdx;
        } else {
          idx++;
        }

        if (nestedHtml) {
          parts.push(`<li>${item.content}\n${nestedHtml}\n</li>`);
        } else {
          parts.push(`<li>${item.content}</li>`);
        }
      } else {
        idx++;
      }
    }

    parts.push(`</${type}>`);
    return { html: parts.join('\n'), endIdx: idx };
  }

  while (i < lines.length) {
    const listMatch = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
    if (listMatch) {
      const items: { depth: number; isOrdered: boolean; content: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
        if (!m) break;
        items.push({
          depth: getDepth(m[1]),
          isOrdered: /^\d+\.$/.test(m[2]),
          content: m[3],
        });
        i++;
      }
      if (items.length > 0) {
        const { html } = renderNestedList(items, 0, -1);
        result.push(html);
      }
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join('\n');
}

/**
 * Extracts Q&A cards from text content
 * @param content The text content to extract cards from
 * @param settings Plugin settings containing question/answer words
 * @returns Array of extracted AnkiCard objects
 */
export function extractQACardsFromText(content: string, settings: PandaZapSettings): AnkiCard[] {
  if (!content || !settings) {
    return [];
  }

  const cards: AnkiCard[] = [];
  const lines = content.split('\n');

  try {
    const escQWord = settings.questionWord.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const escAWord = settings.answerWord.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const escIWord = settings.imageWord.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

    const escQ = `${escQWord}:`;
    const escA = `${escAWord}:`;
    const escI = `${escIWord}:`;

    // Regex start patterns
    const qStartRegex = new RegExp(`^(?:[*_]{0,2})${escQ}\\s*(.+)`, 'i');
    const aStartRegex = new RegExp(`^(?:[*_]{0,2})${escA}\\s*(.*)`, 'i');
    const iStartRegex = new RegExp(`^(?:[*_]{0,2})${escI}\\s*(.*)`, 'i');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Strip blockquote/callout markers (handle nested callouts > >)
      const cleanedLine = line.replace(/^(?:> ?)+/, '');
      if (/^\[!/.test(cleanedLine)) continue;
      line = cleanedLine;

      // 1. Single-line check
      // Check for: Q: ... A: ... I: ... (all on one line)
      const singleLineAll = new RegExp(
        `(?:[*_]{0,2})${escQ}\\s*(.+?)\\s*(?:[*_]{0,2})${escA}\\s*(.+?)\\s*(?:[*_]{0,2})${escI}\\s*(.+)`,
        'i'
      );
      const matchAll = line.match(singleLineAll);
      if (matchAll) {
        cards.push({
          question: matchAll[1].replace(/[*_]+/g, '').trim(),
          answer: convertMarkdownListsToHtml(matchAll[2].replace(/[*_]+/g, '').trim()),
          image: parseImagePath(matchAll[3]) || undefined,
          line: i + 1,
        });
        continue;
      }

      // Check for: Q: ... I: ... (single line without A:)
      const singleLineQI = new RegExp(
        `(?:[*_]{0,2})${escQ}\\s*(.+?)\\s*(?:[*_]{0,2})${escI}\\s*(.+)`,
        'i'
      );
      const matchQI = line.match(singleLineQI);
      if (matchQI) {
        // Ensure the question part doesn't contain a hidden A: tag that we missed
        const aPattern = new RegExp(`(?:[*_]{0,2})${escA}\\s*`, 'i');
        if (!aPattern.test(matchQI[1])) {
          cards.push({
            question: matchQI[1].replace(/[*_]+/g, '').trim(),
            answer: '', // No explicit answer text
            image: parseImagePath(matchQI[2]) || undefined,
            line: i + 1,
          });
          continue;
        }
      }

      // Check for: Q: ... A: ... (without I: or with I: not matching structure)
      const singleLineQA = new RegExp(
        `(?:[*_]{0,2})${escQ}\\s*(.+?)\\s*(?:[*_]{0,2})${escA}\\s*(.+)`,
        'i'
      );
      const matchQA = line.match(singleLineQA);
      if (matchQA) {
        const possibleAnswer = matchQA[2];
        // Ensure the answer part doesn't contain a hidden I: tag that we missed
        const iPattern = new RegExp(`(?:[*_]{0,2})${escI}\\s*`, 'i');
        // We only allow this match if it DOESN'T contain an I: tag, OR if the previous regex failed to parse it correctly
        // but we want to be safe and avoiding consuming the I tag into the answer.
        if (!iPattern.test(possibleAnswer)) {
          cards.push({
            question: matchQA[1].replace(/[*_]+/g, '').trim(),
            answer: convertMarkdownListsToHtml(possibleAnswer.replace(/[*_]+/g, '').trim()),
            line: i + 1,
          });
          continue;
        }
      }

      // 2. Multi-line check
      const qMatch = line.match(qStartRegex);
      if (qMatch) {
        // Start of Q block
        // Strip trailing A:/I: label that might be on the Q line (e.g. "Q: What? A:")
        const aLabelRegex = new RegExp(`\\s*(?:[*_]{0,2})${escA}\\s*$`, 'i');
        const iLabelRegex = new RegExp(`\\s*(?:[*_]{0,2})${escI}\\s*$`, 'i');
        const questionText = qMatch[1].replace(aLabelRegex, '').replace(iLabelRegex, '').trim();
        const answerLines: string[] = [];
        let imagePath: string | undefined = undefined;
        let hasAnswer = false;

        let currentMode: 'none' | 'answer' | 'image' = 'none';

        // Scan ahead
        let j = i + 1;
        while (j < lines.length) {
          let nextLine = lines[j];

          // Strip blockquote/callout markers (handle nested callouts > >)
          const cleanedNextLine = nextLine.replace(/^(?:> ?)+/, '');
          if (/^\[!/.test(cleanedNextLine)) {
            j++;
            continue;
          }
          nextLine = cleanedNextLine;

          // Stop on blank line (end of card)
          if (nextLine.trim() === '') break;
          // Stop on start of next Q (end of card)
          if (qStartRegex.test(nextLine)) break;

          // Check for I: line
          const iMatch = nextLine.match(iStartRegex);
          if (iMatch) {
            currentMode = 'image';
            imagePath = parseImagePath(iMatch[1]);
            j++;
            continue;
          }

          // Check for A: line
          const aMatch = nextLine.match(aStartRegex);
          if (aMatch) {
            currentMode = 'answer';
            hasAnswer = true;
            if (aMatch[1].trim()) {
              answerLines.push(aMatch[1]);
            }
            j++;
            continue;
          }

          // Continue capturing content for Answer
          if (currentMode === 'answer') {
            answerLines.push(nextLine);
          } else if (currentMode === 'image') {
            // If we are in image mode, we usually expect single line.
            // But if user put content on next line without prefix, maybe ignore?
            // Or if image was empty in I: line?
            if (!imagePath) {
              imagePath = parseImagePath(nextLine);
            }
          } else if (currentMode === 'none') {
            // Treat content after Q: as answer even without explicit A: label.
            // This supports bullet lists, tables, etc. after the question.
            currentMode = 'answer';
            hasAnswer = true;
            answerLines.push(nextLine);
          }

          j++;
        }

        // Validity check: A card must have either an answer OR an image
        if (hasAnswer || imagePath) {
          cards.push({
            question: questionText.replace(/[*_]+/g, '').trim(),
            answer: convertMarkdownListsToHtml(answerLines.join('\n').trim()),
            image: imagePath || undefined,
            line: i + 1,
          });
          // Update i to skip processed lines
          i = j - 1;
        }
      }
    }
  } catch {
    return [];
  }

  return cards;
}

export default extractQACardsFromText;