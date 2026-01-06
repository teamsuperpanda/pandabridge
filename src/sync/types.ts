import { ANKI_CONNECT_DEFAULT_URL, ANKI_CONNECT_DEFAULT_PORT } from '../constants';

export interface AnkiCard {
  question: string;
  answer: string;
  image?: string;
  line: number;
}

export interface PandaBridgeSettings {
  ankiConnectUrl: string;
  ankiConnectPort: number;
  defaultDeck: string;
  // Word placed before the required '::' on the first line of a note to explicitly set the target deck (e.g. "Deck")
  deckOverrideWord: string;
  // Word used to mark questions (left side before required ':'), e.g. 'Q'
  questionWord: string;
  // Word used to mark answers (left side before required ':'), e.g. 'A'
  answerWord: string;
  // Word used to mark images (left side before required ':'), e.g. 'I'
  imageWord: string;
  noteType: string;
  useNoteBased: boolean;
  boldQuestionInReadingMode: boolean;
}

export enum CardAction {
  ADD = 'add',
  UPDATE = 'update',
  DELETE = 'delete',
}

export interface CardSyncInfo {
  card: AnkiCard;
  action: CardAction;
  deckName: string;
  existingCardId?: string;
}

export interface SyncAnalysis {
  cardsToAdd: CardSyncInfo[];
  cardsToUpdate: CardSyncInfo[];
  cardsToDelete: CardSyncInfo[];
  totalCards: number;
}

export const DEFAULT_SETTINGS: PandaBridgeSettings = {
  ankiConnectUrl: ANKI_CONNECT_DEFAULT_URL,
  ankiConnectPort: ANKI_CONNECT_DEFAULT_PORT,
  defaultDeck: 'Default',
  deckOverrideWord: 'Deck',
  imageWord: 'I',
  questionWord: 'Q',
  answerWord: 'A',
  noteType: 'Basic',
  useNoteBased: true,
  boldQuestionInReadingMode: true,
};
