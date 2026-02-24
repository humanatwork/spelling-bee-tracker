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

  const loadDay = useCallback(async () => {
    try {
      const [dayData, wordsData] = await Promise.all([
        api.getDay(date),
        api.listWords(date),
      ]);
      setDay(dayData);
      setWords(wordsData);
    } catch (e: any) {
      showToast(e.message, 'warning');
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
          // Insert at top: use after_word_id of 0 won't work, so we handle differently
          // Actually, after_word_id=null means "append". For insert-at-top, we'd need position logic.
          // The server's getPositionAfter with a non-existent ID falls back to getNextPosition.
          // For simplicity, just don't pass after_word_id (appends) — the insert buttons
          // set insertAfterWordId to a real word id, not null for "top".
        } else {
          data.after_word_id = insertAfterWordId;
        }
      }
      await api.addWord(date, data);
      setWordInput('');
      setInsertAfterWordId(undefined);
      await loadDay();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  function handleLetterClick(letter: string) {
    setWordInput(prev => prev + letter);
    focusWordInput();
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
    setSelectedWordId(selectedWordId === word.id ? null : word.id);
    setPointsInput(word.points != null ? String(word.points) : '');
  }

  async function handleAccept() {
    if (!selectedWordId) return;
    const pts = pointsInput ? parseInt(pointsInput) : undefined;
    try {
      await api.updateWord(date, selectedWordId, {
        status: 'accepted',
        ...(pts !== undefined ? { points: pts } : {}),
      });
      setSelectedWordId(null);
      await loadDay();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleReject() {
    if (!selectedWordId) return;
    try {
      await api.updateWord(date, selectedWordId, { status: 'rejected' });
      setSelectedWordId(null);
      await loadDay();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleTogglePangram() {
    if (!selectedWordId) return;
    const word = words.find(w => w.id === selectedWordId);
    if (!word) return;
    try {
      await api.updateWord(date, selectedWordId, { is_pangram: !word.is_pangram });
      await loadDay();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleDeleteWord() {
    if (!selectedWordId) return;
    try {
      await api.deleteWord(date, selectedWordId);
      setSelectedWordId(null);
      await loadDay();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleDeleteDay() {
    try {
      await api.deleteDay(date);
      showToast('Day deleted', 'info');
      onBack();
    } catch (e: any) {
      showToast(e.message, 'warning');
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
                className="px-1.5 py-0.5 bg-red-500 text-white rounded font-medium hover:bg-red-600"
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
                type="number"
                value={pointsInput}
                onChange={e => setPointsInput(e.target.value)}
                placeholder="pts"
                className="w-16 px-2 py-1 text-xs border rounded"
              />
              <button
                onClick={handleAccept}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
              >
                Accept
              </button>
            </div>
            <button
              onClick={handleReject}
              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium"
            >
              Reject
            </button>
            <button
              onClick={handleTogglePangram}
              className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 font-medium"
            >
              {selectedWord.is_pangram ? 'Unmark Pangram' : 'Mark Pangram'}
            </button>
            <button
              onClick={handleDeleteWord}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-medium"
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
