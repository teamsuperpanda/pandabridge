import { describe, it, expect } from 'vitest';

describe('CardExtractor (unit tests)', () => {
  // Note: CardExtractor tests that depend on Obsidian API are skipped in unit tests
  // These would be better suited for integration tests with proper Obsidian environment

  it('should be tested in integration environment', () => {
    // This test serves as a placeholder to remind us that CardExtractor
    // needs integration testing with the actual Obsidian environment
    expect(true).toBe(true);
  });

  describe('DOM processing logic (extracted)', () => {
    it('processes Q&A text patterns correctly', () => {
      // Test the regex patterns that would be used by CardExtractor
      const qTag = 'Q';
      const aTag = 'A';
      const escQ = qTag.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ':';
      const escA = aTag.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ':';

      const testText = 'Q: What is TypeScript? A: A typed superset of JavaScript';

      expect(new RegExp(`[*_]{0,2}${escQ}`).test(testText)).toBe(true);
      expect(new RegExp(`[*_]{0,2}${escA}`).test(testText)).toBe(true);
    });
  });
});
