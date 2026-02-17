import { useState, useEffect } from 'react';
import { api, Day, Word } from '../api';
import { WordInput } from './WordInput';
import { WordList } from './WordList';
import { showToast } from './Toast';

interface Props {
  day: Day;
  words: Word[];
  onWordsChange: () => void;
}

export function NewDiscoveryMode({ day, words, onWordsChange }: Props) {
  const [scratchMode, setScratchMode] = useState(false);
  const [inspireMode, setInspireMode] = useState(false);
  const [inspireSource, setInspireSource] = useState<Word | null>(null);
  const [pulsingId, setPulsingId] = useState<number | null>(null);

  const newDiscoveryWords = words.filter(w => w.stage === 'new-discovery');
  const lastWord = newDiscoveryWords.length > 0 ? newDiscoveryWords[newDiscoveryWords.length - 1] : null;
  const lastPendingWord = [...newDiscoveryWords].reverse().find(w => w.status === 'pending') || null;

  async function handleAddWord(word: string) {
    try {
      if (inspireMode && inspireSource) {
        const result = await api.inspireWord(day.date, inspireSource.id, {
          word,
          status: scratchMode ? 'scratch' : 'pending',
          inspiration_confidence: 'certain',
        });
        if (result.is_reattempt) {
          showToast(`${result.word} — already entered (\u00d7${result.attempt_count})`, 'warning');
          setPulsingId(result.id);
          setTimeout(() => setPulsingId(null), 2000);
        } else {
          showToast(`${result.word} (inspired by ${inspireSource.word})`, 'info');
        }
        setInspireMode(false);
        setInspireSource(null);
      } else {
        const result = await api.addWord(day.date, {
          word,
          stage: 'new-discovery',
          status: scratchMode ? 'scratch' : 'pending',
        });
        if (result.is_reattempt) {
          showToast(`${result.word} — already entered (\u00d7${result.attempt_count})`, 'warning');
          setPulsingId(result.id);
          setTimeout(() => setPulsingId(null), 2000);
        }
      }
      onWordsChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  async function handleStatusChange(word: Word, status: 'accepted' | 'rejected') {
    try {
      await api.updateWord(day.date, word.id, { status });
      onWordsChange();
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  // Keyboard handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 't':
          setScratchMode(prev => !prev);
          break;
        case 'a':
          if (lastPendingWord) {
            handleStatusChange(lastPendingWord, 'accepted');
          }
          break;
        case 'r':
          if (lastPendingWord) {
            handleStatusChange(lastPendingWord, 'rejected');
          }
          break;
        case 'i':
          if (lastWord) {
            setInspireSource(lastWord);
            setInspireMode(true);
          }
          break;
        case 'escape':
          setInspireMode(false);
          setInspireSource(null);
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">New Discovery</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScratchMode(!scratchMode)}
            data-testid="scratch-toggle"
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              scratchMode
                ? 'bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {scratchMode ? 'Scratch ON' : 'Scratch OFF'} <kbd className="ml-1 text-xs opacity-70">T</kbd>
          </button>
          <span className="text-sm text-gray-500">{words.length} words total</span>
        </div>
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
            : scratchMode
            ? 'Scratch attempt...'
            : 'New word...'
        }
      />

      {scratchMode && (
        <div className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1">
          Scratch mode: entries are low-confidence rapid-fire attempts
        </div>
      )}

      {/* New discovery words with inline accept/reject */}
      <div data-testid="new-discovery-words" className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">New Discovery Words</h3>
        {newDiscoveryWords.length === 0 ? (
          <div className="text-gray-400 text-sm italic py-2">Start entering new words</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {newDiscoveryWords.map((word, index) => (
              <div key={word.id} className="flex items-center gap-2 group">
                <div className={`flex-1 flex items-center gap-2 px-2 py-0.5 rounded text-sm font-mono
                  ${word.status === 'accepted' ? 'word-accepted' : ''}
                  ${word.status === 'rejected' ? 'word-rejected' : ''}
                  ${word.status === 'scratch' ? 'word-scratch' : ''}
                  ${word.status === 'pending' ? 'word-pending' : ''}
                  ${word.id === pulsingId ? 'animate-pulse bg-amber-100' : ''}
                `}>
                  <span className="text-gray-400 text-xs w-4">{index + 1}.</span>
                  <span className="flex-1">{word.word}</span>
                  {word.attempt_count > 1 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">
                      &times;{word.attempt_count}
                    </span>
                  )}
                  {word.inspired_by_ids.length > 0 && (
                    <span className="text-xs text-purple-500">&larr;</span>
                  )}
                </div>
                {word.status === 'pending' && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStatusChange(word, 'accepted')}
                      className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                    >
                      &#10003;
                    </button>
                    <button
                      onClick={() => handleStatusChange(word, 'rejected')}
                      className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                    >
                      &#10007;
                    </button>
                  </div>
                )}
                <button
                  onClick={() => { setInspireSource(word); setInspireMode(true); }}
                  className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs opacity-0 group-hover:opacity-100 hover:bg-purple-200"
                  title="Add inspired word"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full word list */}
      <details data-testid="full-word-list" className="mt-4">
        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
          Full word list ({words.length} words)
        </summary>
        <div className="mt-2">
          <WordList words={words} pulsingId={pulsingId} />
        </div>
      </details>
    </div>
  );
}
