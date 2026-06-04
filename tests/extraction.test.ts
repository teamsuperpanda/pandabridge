import { describe, it, expect } from 'vitest';
import { extractQACardsFromText } from '../src/sync/extractionUtils';
import { PandaZapSettings } from '../src/sync/types';

const defaultSettings: PandaZapSettings = {
  ankiConnectUrl: 'http://127.0.0.1',
  ankiConnectPort: 8765,
  defaultDeck: 'Default',
  deckOverrideWord: 'Deck',
  questionWord: 'Q',
  answerWord: 'A',
  noteType: 'Basic',
  useNoteBased: true,
  boldQuestionInReadingMode: true,
  imageWord: 'I',
};

describe('extractQACardsFromText', () => {
  it('should handle empty or null input gracefully', () => {
    expect(extractQACardsFromText('', defaultSettings)).toEqual([]);
    expect(extractQACardsFromText(null as any, defaultSettings)).toEqual([]);
    expect(extractQACardsFromText('test', null as any)).toEqual([]);
  });

  it('should extract single line Q&A cards', () => {
    const content = 'Q: What is TypeScript? A: A typed superset of JavaScript';
    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      question: 'What is TypeScript?',
      answer: 'A typed superset of JavaScript',
      line: 1,
    });
  });

  it('should extract multi-line Q&A cards', () => {
    const content = `Q: What is React?
A: A JavaScript library for building user interfaces
It was created by Facebook`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      question: 'What is React?',
      answer: 'A JavaScript library for building user interfaces\nIt was created by Facebook',
      line: 1,
    });
  });

  it('should handle custom question and answer words', () => {
    const customSettings = {
      ...defaultSettings,
      questionWord: 'Question',
      answerWord: 'Answer',
    };

    const content = 'Question: What is Vue? Answer: A progressive JavaScript framework';
    const cards = extractQACardsFromText(content, customSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('What is Vue?');
    expect(cards[0].answer).toBe('A progressive JavaScript framework');
  });

  it('should return empty array for invalid input', () => {
    expect(extractQACardsFromText('No Q&A here', defaultSettings)).toEqual([]);
    expect(extractQACardsFromText('Q: just a question with nothing after', defaultSettings)).toEqual([]);
  });

  it('should capture bullet points after Q: without explicit A:', () => {
    const content = `Q: What are the types of fruit?
- Apple
- Banana
- Orange`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('What are the types of fruit?');
    expect(cards[0].answer).toBe('<ul>\n<li>Apple</li>\n<li>Banana</li>\n<li>Orange</li>\n</ul>');
  });

  it('should capture tables after Q: without explicit A:', () => {
    const content = `Q: Conversion rates
| From | To | Rate |
| --- | --- | --- |
| USD | EUR | 0.85 |
| EUR | USD | 1.18 |`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Conversion rates');
    expect(cards[0].answer).toBe('| From | To | Rate |\n| --- | --- | --- |\n| USD | EUR | 0.85 |\n| EUR | USD | 1.18 |');
  });

  it('should handle bullet points with explicit A: on same Q: line', () => {
    const content = `Q: Key features? A:
- Fast
- Reliable
- Scalable`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Key features?');
    expect(cards[0].answer).toBe('<ul>\n<li>Fast</li>\n<li>Reliable</li>\n<li>Scalable</li>\n</ul>');
  });

  it('should capture mixed content after Q: as answer', () => {
    const content = `Q: Steps to deploy
1. Build the app
2. Run tests
3. Deploy to server`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Steps to deploy');
    expect(cards[0].answer).toBe('<ol>\n<li>Build the app</li>\n<li>Run tests</li>\n<li>Deploy to server</li>\n</ol>');
  });

  it('should strip callout markers and skip callout headers', () => {
    const content = `> [!question]
> Q: What is the capital of France?
> A: Paris`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('What is the capital of France?');
    expect(cards[0].answer).toBe('Paris');
  });

  it('should convert unordered list (-) to HTML', () => {
    const content = `Q: What are fruits?
A:
- Apple
- Banana
- Orange`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('What are fruits?');
    expect(cards[0].answer).toBe('<ul>\n<li>Apple</li>\n<li>Banana</li>\n<li>Orange</li>\n</ul>');
  });

  it('should convert unordered list (*) to HTML', () => {
    const content = `Q: Key features?
* Fast
* Reliable
* Scalable`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Key features?');
    expect(cards[0].answer).toBe('<ul>\n<li>Fast</li>\n<li>Reliable</li>\n<li>Scalable</li>\n</ul>');
  });

  it('should convert ordered list to HTML', () => {
    const content = `Q: Process
1. Plan
2. Execute
3. Review`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Process');
    expect(cards[0].answer).toBe('<ol>\n<li>Plan</li>\n<li>Execute</li>\n<li>Review</li>\n</ol>');
  });

  it('should handle mixed content with text before and after list', () => {
    const content = `Q: Describe the process
First, you need to prepare.
- Gather materials
- Set up workspace
Then you can begin.`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Describe the process');
    expect(cards[0].answer).toBe('First, you need to prepare.\n<ul>\n<li>Gather materials</li>\n<li>Set up workspace</li>\n</ul>\nThen you can begin.');
  });

  it('should handle Q&A inside callout blocks (George Thomas example)', () => {
    const content = `> [!question] George Thomas
> Q: Who was George Thomas?
> A: An American general known as the "Rock of Chickamauga"
> He served in the Union Army during the Civil War`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Who was George Thomas?');
    expect(cards[0].answer).toBe('An American general known as the "Rock of Chickamauga"\nHe served in the Union Army during the Civil War');
  });

  it('should handle nested callout blocks with lists in answers', () => {
    const content = `> [!NOTE]-
> George Thomas
>
> > [!question]- What is A?
> > Q: What is A?
> > A:
> > - George Thomas was from Ireland.
> > - He was a mercenary commander for the Marathas.
>
> > [!question]- What is B?
> > Q: What is B?
> > A:
> > - He attacked Jaipur, Udaipur, and Bikaner.
> > - In 1800 A.D., he used the term "Rajputana" for the Rajasthan region for the first time.
>
> > [!question]- What is C?
> > Q: What is C?
> > A:
> > - In 1805 A.D., William Franklin published a book titled Military Memoirs of George Thomas.
> > - He is also known as "Jahazi Firangi."`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(3);

    expect(cards[0].question).toBe('What is A?');
    expect(cards[0].answer).toBe('<ul>\n<li>George Thomas was from Ireland.</li>\n<li>He was a mercenary commander for the Marathas.</li>\n</ul>');

    expect(cards[1].question).toBe('What is B?');
    expect(cards[1].answer).toBe('<ul>\n<li>He attacked Jaipur, Udaipur, and Bikaner.</li>\n<li>In 1800 A.D., he used the term "Rajputana" for the Rajasthan region for the first time.</li>\n</ul>');

    expect(cards[2].question).toBe('What is C?');
    expect(cards[2].answer).toBe('<ul>\n<li>In 1805 A.D., William Franklin published a book titled Military Memoirs of George Thomas.</li>\n<li>He is also known as "Jahazi Firangi."</li>\n</ul>');
  });

  it('should convert nested lists with tab indentation to nested HTML', () => {
    const content = `Q: Nested list example
A:
- One
\t- Two
\t\t- Three
- Four
\t- Five
\t\t- Six`;

    const cards = extractQACardsFromText(content, defaultSettings);

    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Nested list example');
    expect(cards[0].answer).toBe(
      '<ul>\n<li>One\n<ul>\n<li>Two\n<ul>\n<li>Three</li>\n</ul>\n</li>\n</ul>\n</li>\n<li>Four\n<ul>\n<li>Five\n<ul>\n<li>Six</li>\n</ul>\n</li>\n</ul>\n</li>\n</ul>'
    );
  });
});
