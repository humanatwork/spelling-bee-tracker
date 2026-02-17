import { useState, useEffect, useCallback } from 'react';
import { api, Day, Word, BackfillState } from '../api';
import { WordInput } from './WordInput';
import { WordList } from './WordList';
import { showToast } from './Toast';

interface Props {
  day: Day;
  words: Word[];
  onWordsChange: () => void;
  onDayChange: () => void;
}

export function BackfillMode({ day, words, onWordsChange, onDayChange }: Props) {
  const [backfillState, setBackfillState] = useState<BackfillState | null>(null);
  const [chainStack, setChainStack] = useState<Word[]>([]);
  const [inspireMode, setInspireMode] = useState(false);
  const [judgedStatus, setJudgedStatus] = useState<'accepted' | 'rejected' | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBackfill = useCallback(async () => {
    try {
      const state = await api.getBackfillState(day.date);
      setBackfillState(state);
    } catch (e: any) {
      showToast(e.message, 'warning');
    } finally {
      setLoading(false);
    }
  }, [day.date]);

  useEffect(() => {
    loadBackfill();
  }, [loadBackfill]);

  const activeWord = chainStack.length > 0
    ? chainStack[chainStack.length - 1]
    : backfillState?.current_word;

  async function handleAction(action: 'accept' | 'reject' | 'skip') {
    if (chainStack.length > 0) {
      // We're in a chain — mark the chain word and pop
      const chainWord = chainStack[chainStack.length - 1];
      const statusMap: Record<string, string> = { accept: 'accepted', reject: 'rejected', skip: 'pending' };
      await api.updateWord(day.date, chainWord.id, { status: statusMap[action] as any });
      setChainStack(prev => prev.slice(0, -1));
      setInspireMode(false);
      onWordsChange();
      return;
    }

    if (action === 'skip') {
      // Skip advances immediately
      try {
        const result = await api.advanceBackfill(day.date, 'skip');
        if (result.is_complete) {
          showToast('Backfill complete! Transitioning to new discovery mode.', 'success');
          await api.completeBackfill(day.date);
          onDayChange();
        }
        setInspireMode(false);
        setJudgedStatus(null);
        await loadBackfill();
        onWordsChange();
      } catch (e: any) {
        showToast(e.message, 'warning');
      }
      return;
    }

    // Accept or reject: set status but don't advance cursor
    if (!activeWord) return;
    try {
      const status = action === 'accept' ? 'accepted' : 'rejected';
      await api.updateWord(day.date, activeWord.id, { status });
      setJudgedStatus(status);
      setInspireMode(false);
      onWordsChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleNext() {
    if (!judgedStatus) return;
    try {
      const result = await api.advanceBackfill(day.date, 'skip');
      if (result.is_complete) {
        showToast('Backfill complete! Transitioning to new discovery mode.', 'success');
        await api.completeBackfill(day.date);
        onDayChange();
      }
      setJudgedStatus(null);
      setInspireMode(false);
      await loadBackfill();
      onWordsChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleInspire(word: string) {
    if (!activeWord) return;
    try {
      const result = await api.inspireWord(day.date, activeWord.id, {
        word,
        status: 'pending',
        inspiration_confidence: 'certain',
        chain_depth: (activeWord.chain_depth || 0) + 1,
      });
      if (result.is_reattempt) {
        showToast(`${result.word} — already entered (\u00d7${result.attempt_count})`, 'warning');
        setInspireMode(false);
      } else {
        // Push onto chain stack
        setChainStack(prev => [...prev, result]);
        setInspireMode(false);
        showToast(`${result.word} added (chain depth ${result.chain_depth})`, 'info');
      }
      onWordsChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  function handleEscape() {
    if (inspireMode) {
      setInspireMode(false);
      return;
    }
    if (chainStack.length > 0) {
      setChainStack(prev => prev.slice(0, -1));
      return;
    }
  }

  function handleBackToList() {
    setChainStack([]);
    setInspireMode(false);
  }

  // Keyboard handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'a':
          if (!judgedStatus) handleAction('accept');
          break;
        case 'r':
          if (!judgedStatus) handleAction('reject');
          break;
        case 's':
          if (!judgedStatus) handleAction('skip');
          break;
        case 'n':
          if (judgedStatus) handleNext();
          break;
        case 'i': setInspireMode(true); break;
        case 'escape': handleEscape(); break;
        case 'b': handleBackToList(); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading backfill state...</div>;
  }

  if (!backfillState || backfillState.is_complete) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-gray-700">All pre-pangram words have been processed!</p>
        <button
          onClick={async () => {
            await api.completeBackfill(day.date);
            onDayChange();
          }}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Continue to New Discovery
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Left panel: backfill controls */}
      <div className="flex-[3] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Backfill Mode</h2>
          <span data-testid="progress-text" className="text-sm text-gray-500">
            {backfillState.processed_count}/{backfillState.total_pre_pangram} processed
          </span>
        </div>

        {/* Progress bar */}
        <div data-testid="progress-bar" className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-bee-yellow h-2 rounded-full transition-all"
            style={{ width: `${(backfillState.processed_count / backfillState.total_pre_pangram) * 100}%` }}
          />
        </div>

        {/* Current word */}
        {activeWord && (
          <div className="bg-white border-2 border-blue-300 rounded-xl p-6 text-center space-y-4">
            {/* Chain breadcrumb */}
            {chainStack.length > 0 && (
              <div data-testid="chain-breadcrumb" className="text-xs text-purple-500 flex items-center justify-center gap-1">
                {backfillState.current_word && (
                  <span className="text-gray-500">{backfillState.current_word.word}</span>
                )}
                {chainStack.map((w, i) => (
                  <span key={w.id}>
                    <span className="text-gray-400"> &rarr; </span>
                    <span className={i === chainStack.length - 1 ? 'font-bold text-purple-700' : ''}>
                      {w.word}
                    </span>
                  </span>
                ))}
                <span className="ml-2 text-gray-400">(depth {chainStack.length})</span>
              </div>
            )}

            <div data-testid="current-word" className="text-4xl font-mono font-bold text-gray-800 uppercase tracking-wider">
              {activeWord.word}
            </div>
            <div className="text-sm text-gray-500">
              {activeWord.is_pangram ? 'PANGRAM' : `Word ${backfillState.cursor_index + 1}`}
            </div>

            {/* Judged state: show status badge + inspire + next */}
            {judgedStatus && !inspireMode && chainStack.length === 0 && (
              <div className="space-y-3">
                <span data-testid="judged-badge" className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  judgedStatus === 'accepted'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {judgedStatus === 'accepted' ? 'Accepted' : 'Rejected'}
                </span>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setInspireMode(true)}
                    className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium"
                  >
                    <kbd className="mr-1 text-purple-200">I</kbd>nspire
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                  >
                    <kbd className="mr-1 text-blue-200">N</kbd>ext
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons (pre-judgment) */}
            {!judgedStatus && !inspireMode && chainStack.length === 0 && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleAction('accept')}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                >
                  <kbd className="mr-1 text-green-200">A</kbd>ccept
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                >
                  <kbd className="mr-1 text-red-200">R</kbd>eject
                </button>
                <button
                  onClick={() => handleAction('skip')}
                  className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium"
                >
                  <kbd className="mr-1 text-gray-200">S</kbd>kip
                </button>
                <button
                  onClick={() => setInspireMode(true)}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium"
                >
                  <kbd className="mr-1 text-purple-200">I</kbd>nspire
                </button>
              </div>
            )}

            {/* Chain word buttons (same as before — chain words don't use judged state) */}
            {!inspireMode && chainStack.length > 0 && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleAction('accept')}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                >
                  <kbd className="mr-1 text-green-200">A</kbd>ccept
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                >
                  <kbd className="mr-1 text-red-200">R</kbd>eject
                </button>
                <button
                  onClick={() => handleAction('skip')}
                  className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium"
                >
                  <kbd className="mr-1 text-gray-200">S</kbd>kip
                </button>
                <button
                  onClick={() => setInspireMode(true)}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium"
                >
                  <kbd className="mr-1 text-purple-200">I</kbd>nspire
                </button>
              </div>
            )}

            {/* Inspire input */}
            {inspireMode && (
              <div className="space-y-2">
                <p className="text-sm text-purple-600">
                  What word did "{activeWord.word}" inspire?
                </p>
                <WordInput
                  onSubmit={handleInspire}
                  letters={day.letters}
                  centerLetter={day.center_letter}
                  placeholder="Inspired word..."
                  autoFocus
                />
                <button
                  onClick={() => setInspireMode(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel (Esc)
                </button>
              </div>
            )}

            {/* Chain controls */}
            {chainStack.length > 0 && !inspireMode && (
              <div className="flex justify-center gap-2 text-sm">
                <button onClick={handleEscape} className="text-gray-500 hover:text-gray-700">
                  <kbd className="mr-1 px-1 bg-gray-100 border rounded">Esc</kbd> Pop chain
                </button>
                <button onClick={handleBackToList} className="text-gray-500 hover:text-gray-700">
                  <kbd className="mr-1 px-1 bg-gray-100 border rounded">B</kbd> Back to list
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete button */}
        <button
          onClick={async () => {
            await api.completeBackfill(day.date);
            onDayChange();
          }}
          className="w-full py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
        >
          Skip remaining &amp; continue to New Discovery
        </button>
      </div>

      {/* Right panel: word list */}
      <div data-testid="backfill-word-list" className="flex-[2] border-l pl-4 overflow-y-auto max-h-[70vh]">
        <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase">Word List</h3>
        <WordList
          words={words}
          cursorId={backfillState.current_word?.id}
          highlightId={activeWord?.id}
        />
      </div>
    </div>
  );
}
