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
  const [pangramCandidate, setPangramCandidate] = useState<Word | null>(null);
  const [inspireMode, setInspireMode] = useState(false);
  const [inspireSource, setInspireSource] = useState<Word | null>(null);

  async function handleAddWord(word: string) {
    try {
      if (inspireMode && inspireSource) {
        const result = await api.inspireWord(day.date, inspireSource.id, {
          word,
          status: 'pending',
          inspiration_confidence: 'certain',
        });
        if (result.is_reattempt) {
          showToast(`${result.word} — already entered (×${result.attempt_count})`, 'warning');
          setPulsingId(result.id);
          setTimeout(() => setPulsingId(null), 2000);
        } else {
          showToast(`${result.word} (inspired by ${inspireSource.word})`, 'info');
        }
        setInspireMode(false);
        setInspireSource(null);
        onWordsChange();
        return;
      }

      const result = await api.addWord(day.date, { word, stage: 'pre-pangram' });
      if (result.is_reattempt) {
        showToast(`${result.word} — already entered (×${result.attempt_count})`, 'warning');
        setPulsingId(result.id);
        setTimeout(() => setPulsingId(null), 2000);
        onWordsChange();
        return;
      }
      if (isPangramCandidate(result.word)) {
        setPangramCandidate(result);
        onWordsChange();
        return;
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
      setPangramCandidate(null);
      onWordsChange();
      onDayChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleRejectCandidate() {
    if (!pangramCandidate) return;
    try {
      await api.updateWord(day.date, pangramCandidate.id, { status: 'rejected' });
      showToast(`${pangramCandidate.word} marked as rejected`, 'info');
      setPangramCandidate(null);
      onWordsChange();
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
        <span data-testid="word-count" className="text-sm text-gray-500">{words.length} words</span>
      </div>

      {inspireMode && inspireSource && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 flex items-center justify-between">
          <span>Adding word inspired by <strong>{inspireSource.word}</strong></span>
          <button onClick={() => { setInspireMode(false); setInspireSource(null); }} className="text-purple-500 hover:text-purple-700">
            Cancel
          </button>
        </div>
      )}

      <WordInput
        onSubmit={handleAddWord}
        letters={day.letters}
        centerLetter={day.center_letter}
        placeholder={
          inspireMode && inspireSource
            ? `Inspired by ${inspireSource.word}...`
            : 'Brainstorm words... (Enter to add)'
        }
        disabled={!!pangramCandidate}
      />

      {pangramCandidate && (
        <div data-testid="pangram-dialog" className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 text-center space-y-3">
          <p className="text-sm text-yellow-800 font-medium">
            <span className="font-mono text-lg uppercase">{pangramCandidate.word}</span> uses all 7 letters!
          </p>
          <p className="text-sm text-yellow-700">Is this the pangram?</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleMarkPangram(pangramCandidate)}
              className="px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg font-medium hover:bg-yellow-500"
            >
              Yes, it's the pangram
            </button>
            <button
              onClick={handleRejectCandidate}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              No (mark rejected)
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Click a word to add an inspired word, or press <kbd className="px-1 bg-gray-100 border rounded">P</kbd> to mark the last word as pangram
      </div>

      <WordList
        words={words}
        pulsingId={pulsingId}
        onWordClick={(word) => {
          setInspireSource(word);
          setInspireMode(true);
        }}
      />
    </div>
  );
}
