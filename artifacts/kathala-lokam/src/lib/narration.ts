/**
 * Small helpers for story narration in English (en), Hindi (hi) and Telugu (te).
 * Kept out of App.tsx so the language/voice/sentence rules live in one place.
 */

export type NarrationLanguage = 'en' | 'hi' | 'te';

/** One sentence of recorded narration, produced by the `narrate` script for each language. */
export type NarrationSentence = { scene: number; text: string; start: number; end: number };

const LANGUAGE_KEY = 'kathala-story-language';

/** BCP-47 tags used for speech and for the `lang` attribute (en-IN, hi-IN, te-IN). */
export const SPEECH_LANG: Record<NarrationLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

export const LANGUAGE_LABEL: Record<NarrationLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
};

export function isNarrationLanguage(code: string): code is NarrationLanguage {
  return code === 'en' || code === 'hi' || code === 'te';
}

/** Last language the child picked, or '' if none (browser storage can be unavailable). */
export function loadLanguage(): string {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return value && isNarrationLanguage(value) ? value : '';
  } catch {
    return '';
  }
}

export function saveLanguage(code: string) {
  try {
    localStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // storage blocked: the choice simply is not remembered
  }
}

const FEMALE_VOICE_HINT =
  /female|zira|aria|jenny|ana|samantha|neerja|heera|swara|shruti|kalpana|google (uk english female|us english|हिन्दी|తెలుగు)/i;

/**
 * Browser voice for a language. Prefers a girl's voice. English keeps the earlier behaviour
 * (any English voice). Hindi and Telugu use only a voice of the same language, so a story is
 * never read aloud in the wrong language; returns undefined when the device has none.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], code: string): SpeechSynthesisVoice | undefined {
  if (!isNarrationLanguage(code)) return undefined;
  const sameLanguage = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(code));
  const exact = sameLanguage.filter(v => v.lang.toLowerCase().replace('_', '-') === SPEECH_LANG[code].toLowerCase());
  const pool = code !== 'en' && exact.length > 0 ? exact : sameLanguage;
  return pool.find(v => FEMALE_VOICE_HINT.test(v.name)) ?? pool[0];
}

/** Sentence at the given audio time (last sentence that has started). */
export function sentenceAt(sentences: NarrationSentence[], time: number): NarrationSentence | undefined {
  let found: NarrationSentence | undefined;
  for (const sentence of sentences) {
    if (sentence.start <= time + 0.05) found = sentence;
    else break;
  }
  return found;
}

/** Splits text into sentences on . ! ? and the Devanagari danda, keeping character positions. */
export function splitSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const pieces: Array<{ text: string; start: number; end: number }> = [];
  const pattern = /[^.!?।]+[.!?।]+["”’)]*\s*|[^.!?।]+$/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed) pieces.push({ text: trimmed, start: match.index, end: match.index + match[0].length });
  }
  return pieces;
}
