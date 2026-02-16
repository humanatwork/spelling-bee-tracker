import { useState } from 'react';
import { api, Day, Word } from '../api';
import { WordInput } from './WordInput';
import { WordList } from './WordList';
import { showToast } from './Toast';

interface Props {
  day: Day;
  words: Word[];
  onWordsChange: () => void;
  onDayChange: () => void;
}

export function PrePangramMode({ day, words, onWordsChange, onDayChange }: Props) {
  const [pulsingId, setPulsingId] = useState<number | null>(null);

  async function handleAddWord(word: string) {
    try {
      const result = await api.addWord(day.date, { word, stage: 'pre-pangram' });
      if (result.is_reattempt) {
        showToast(`${result.word} — already entered (\u00d7${result.attempt_count})`, 'warning');
        setPulsingId(result.id);
        setTimeout(() => setPulsingId(null), 2000);
      }
      onWordsChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleMarkPangram(word: Word) {
    try {
      // Mark as pangram
      await api.updateWord(day.date, word.id, { is_pangram: true });
      // Transition to backfill
      await api.updateDay(day.date, { current_stage: 'backfill' });
      showToast(`${word.word} marked as pangram! Entering backfill mode.`, 'success');
      onWordsChange();
      onDayChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  // Check if all 7 letters are used (pangram detection)
  function isPangramCandidate(word: string): boolean {
    const letterSet = new Set(day.letters.map(l => l.toUpperCase()));
    const wordLetters = new Set(word.toUpperCase().split(''));
    for (const l of letterSet) {
      if (!wordLetters.has(l)) return false;
    }
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">Pre-Pangram Brainstorming</h2>
        <span className="text-sm text-gray-500">{words.length} words</span>
      </div>

      <WordInput
        onSubmit={handleAddWord}
        letters={day.letters}
        centerLetter={day.center_letter}
        placeholder="Brainstorm words... (Enter to add)"
      />

      <div className="text-xs text-gray-500">
        Click a word to mark it as pangram, or press <kbd className="px-1 bg-gray-100 border rounded">P</kbd> for the last word
      </div>

      <WordList
        words={words}
        pulsingId={pulsingId}
        onWordClick={(word) => {
          if (isPangramCandidate(word.word)) {
            handleMarkPangram(word);
          } else {
            showToast(`${word.word} doesn't use all 7 letters — not a pangram`, 'warning');
          }
        }}
      />
    </div>
  );
}
