import { useState, useEffect, useCallback } from 'react';
import { api, Day, Word } from '../api';
import { LetterHexagons } from './LetterHexagons';
import { WordInput, focusWordInput } from './WordInput';
import { WordList } from './WordList';
import { KeyboardHelp } from './KeyboardHelp';
import { showToast } from './Toast';

interface Props {
  date: string;
  onBack: () => void;
}

export function DayPage({ date, onBack }: Props) {
  const [day, setDay] = useState<Day | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [wordInput, setWordInput] = useState('');
  const [insertAfterWordId, setInsertAfterWordId] = useState<number | undefined>(undefined);
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pointsInput, setPointsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadDay = useCallback(async () => {
    try {
      const [dayData, wordsData] = await Promise.all([
        api.getDay(date),
        api.listWords(date),
      ]);
      setDay(dayData);
      setWords(wordsData);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load day';
      showToast(message, 'warning');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  async function handleSubmitWord(word: string) {
    try {
      const data: { word: string; is_pangram?: boolean; after_word_id?: number } = { word };
      if (insertAfterWordId !== undefined) {
        if (insertAfterWordId === null) {
          // null means "top" — omit after_word_id so server appends
        } else {
          data.after_word_id = insertAfterWordId;
        }
      }
      await api.addWord(date, data);
      setWordInput('');
      setInsertAfterWordId(undefined);
      await loadDay();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to add word';
      showToast(message, 'warning');
    }
  }

  function handleLetterClick(letter: string) {
    setWordInput(prev => prev + letter);
    focusWordInput();
  }

  async function handleShuffle() {
    if (!day) return;
    const letters = [...day.letters];
    // Fisher-Yates shuffle on indices 1-6 (keep center letter at index 0)
    for (let i = letters.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i); // random index from 1 to i
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    try {
      const updated = await api.reorderLetters(date, letters);
      setDay(updated);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to shuffle letters';
      showToast(message, 'warning');
    }
  }

  function handleInsertClick(afterWordId: number | null) {
    if (afterWordId === null) {
      // Clicking the top insert button — just append (no after_word_id)
      setInsertAfterWordId(undefined);
    } else if (insertAfterWordId === afterWordId) {
      // Toggle off
      setInsertAfterWordId(undefined);
    } else {
      setInsertAfterWordId(afterWordId);
      const word = words.find(w => w.id === afterWordId);
      if (word) {
        showToast(`Inserting after ${word.word}`, 'info');
      }
    }
    focusWordInput();
  }

  function handleWordClick(word: Word) {
    if (word.status_from_word_id != null) return;
    setSelectedWordId(selectedWordId === word.id ? null : word.id);
    setPointsInput(word.points != null ? String(word.points) : '');
  }

  async function handleAccept() {
    if (!selectedWordId || busy) return;
    if (pointsInput) {
      if (!/^\d+$/.test(pointsInput)) {
        showToast('Points must be a whole number', 'warning');
        return;
      }
    }
    const pts = pointsInput ? parseInt(pointsInput, 10) : undefined;
    setBusy(true);
    try {
      await api.updateWord(date, selectedWordId, {
        status: 'accepted',
        ...(pts !== undefined ? { points: pts } : {}),
      });
      setSelectedWordId(null);
      await loadDay();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to accept word';
      showToast(message, 'warning');
    } finally {
      setBusy(false);
    }
  }

  function handlePointsKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (pointsInput) handleAccept();
    }
  }

  async function handleReject() {
    if (!selectedWordId || busy) return;
    setBusy(true);
    try {
      await api.updateWord(date, selectedWordId, { status: 'rejected' });
      setSelectedWordId(null);
      await loadDay();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to reject word';
      showToast(message, 'warning');
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePangram() {
    if (!selectedWordId || busy) return;
    const word = words.find(w => w.id === selectedWordId);
    if (!word) return;
    setBusy(true);
    try {
      await api.updateWord(date, selectedWordId, { is_pangram: !word.is_pangram });
      await loadDay();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to toggle pangram';
      showToast(message, 'warning');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWord() {
    if (!selectedWordId || busy) return;
    setBusy(true);
    try {
      await api.deleteWord(date, selectedWordId);
      setSelectedWordId(null);
      await loadDay();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete word';
      showToast(message, 'warning');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDay() {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteDay(date);
      showToast('Day deleted', 'info');
      onBack();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete day';
      showToast(message, 'warning');
    } finally {
      setBusy(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (showHelp) { setShowHelp(false); return; }
        if (selectedWordId) { setSelectedWordId(null); return; }
        if (confirmDelete) { setConfirmDelete(false); return; }
        onBack();
        return;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (loading || !day) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  const selectedWord = words.find(w => w.id === selectedWordId);
  const totalPoints = words
    .filter(w => w.status === 'accepted' && w.points != null)
    .reduce((sum, w) => sum + (w.points || 0), 0);
  const wordCount = words.length;
  const pangramCount = words.filter(w => w.is_pangram).length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          data-testid="back-button"
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          &larr; Days
        </button>
        <h1 className="text-xl font-bold text-gray-800" data-testid="day-date">{day.date}</h1>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <span className="flex items-center gap-1 text-xs">
              <span className="text-gray-600">Delete day?</span>
              <button
                data-testid="delete-confirm-yes"
                onClick={handleDeleteDay}
                disabled={busy}
                className="px-1.5 py-0.5 bg-red-500 text-white rounded font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Yes
              </button>
              <button
                data-testid="delete-confirm-no"
                onClick={() => setConfirmDelete(false)}
                className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-medium hover:bg-gray-300"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              data-testid="delete-day-button"
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs hover:bg-gray-300 flex items-center justify-center"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        {/* Beehive display */}
        <div className="flex justify-center mb-6">
          <LetterHexagons
            letters={day.letters}
            centerLetter={day.center_letter}
            onLetterClick={handleLetterClick}
            onShuffle={handleShuffle}
            size="lg"
          />
        </div>

        {/* Word input */}
        <div className="mb-4">
          <WordInput
            value={wordInput}
            onChange={setWordInput}
            onSubmit={handleSubmitWord}
            letters={day.letters}
            centerLetter={day.center_letter}
            placeholder={insertAfterWordId !== undefined ? 'Inserting word...' : 'Type a word...'}
          />
          {insertAfterWordId !== undefined && (
            <div className="mt-1 flex items-center gap-2 text-xs text-amber-600">
              <span>Inserting after {words.find(w => w.id === insertAfterWordId)?.word || 'start'}</span>
              <button
                onClick={() => setInsertAfterWordId(undefined)}
                className="text-gray-400 hover:text-gray-600"
              >
                (cancel)
              </button>
            </div>
          )}
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 pb-4 border-b">
          <span className="font-medium">{totalPoints} pts</span>
          <span>{wordCount} words</span>
          {pangramCount > 0 && <span>{pangramCount} pangram{pangramCount > 1 ? 's' : ''}</span>}
        </div>

        {/* Selected word actions */}
        {selectedWord && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm">{selectedWord.word}</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pointsInput}
                onChange={e => setPointsInput(e.target.value)}
                onKeyDown={handlePointsKeyDown}
                placeholder="pts"
                className="w-16 px-2 py-1 text-xs border rounded"
              />
              <button
                onClick={handleAccept}
                disabled={busy}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium disabled:opacity-50"
              >
                Accept
              </button>
            </div>
            <button
              onClick={handleReject}
              disabled={busy}
              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={handleTogglePangram}
              disabled={busy}
              className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 font-medium disabled:opacity-50"
            >
              {selectedWord.is_pangram ? 'Unmark Pangram' : 'Mark Pangram'}
            </button>
            <button
              onClick={handleDeleteWord}
              disabled={busy}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-medium disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedWordId(null)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Word list */}
        <WordList
          words={words}
          selectedWordId={selectedWordId}
          insertAfterWordId={insertAfterWordId}
          onWordClick={handleWordClick}
          onInsertClick={handleInsertClick}
        />
      </div>

      {showHelp && (
        <KeyboardHelp onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}
