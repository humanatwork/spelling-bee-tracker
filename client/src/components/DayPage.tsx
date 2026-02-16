import { useState, useEffect, useCallback } from 'react';
import { api, Day, Word } from '../api';
import { LetterHexagons } from './LetterHexagons';
import { PrePangramMode } from './PrePangramMode';
import { BackfillMode } from './BackfillMode';
import { NewDiscoveryMode } from './NewDiscoveryMode';
import { KeyboardHelp } from './KeyboardHelp';
import { showToast } from './Toast';

interface Props {
  date: string;
  onBack: () => void;
}

export function DayPage({ date, onBack }: Props) {
  const [day, setDay] = useState<Day | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [showHelp, setShowHelp] = useState(false);
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

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      if (e.key.toLowerCase() === 'g' && day) {
        api.updateDay(date, { genius_achieved: !day.genius_achieved }).then(() => {
          loadDay();
          showToast(day.genius_achieved ? 'Genius unmarked' : 'Genius achieved!', 'success');
        });
        return;
      }

      // P key in pre-pangram mode: mark last word as pangram
      if (e.key.toLowerCase() === 'p' && day?.current_stage === 'pre-pangram' && words.length > 0) {
        const lastWord = words[words.length - 1];
        const letterSet = new Set(day.letters.map(l => l.toUpperCase()));
        const wordLetters = new Set(lastWord.word.toUpperCase().split(''));
        let isPangram = true;
        for (const l of letterSet) {
          if (!wordLetters.has(l)) { isPangram = false; break; }
        }
        if (isPangram) {
          api.updateWord(date, lastWord.id, { is_pangram: true }).then(() =>
            api.updateDay(date, { current_stage: 'backfill' }).then(() => {
              showToast(`${lastWord.word} marked as pangram! Entering backfill mode.`, 'success');
              loadDay();
            })
          );
        } else {
          showToast(`${lastWord.word} doesn't use all 7 letters`, 'warning');
        }
        return;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (loading || !day) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  const stageLabels: Record<string, string> = {
    'pre-pangram': 'Pre-Pangram',
    'backfill': 'Backfill',
    'new-discovery': 'New Discovery',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            &larr; Days
          </button>
          <h1 className="text-xl font-bold text-gray-800">{day.date}</h1>
          <LetterHexagons letters={day.letters} centerLetter={day.center_letter} />
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            day.current_stage === 'pre-pangram' ? 'bg-amber-100 text-amber-800' :
            day.current_stage === 'backfill' ? 'bg-blue-100 text-blue-800' :
            'bg-green-100 text-green-800'
          }`}>
            {stageLabels[day.current_stage]}
          </span>
          {day.genius_achieved && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
              Genius
            </span>
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

      {/* Stage-specific content */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {day.current_stage === 'pre-pangram' && (
          <PrePangramMode
            day={day}
            words={words}
            onWordsChange={loadDay}
            onDayChange={loadDay}
          />
        )}
        {day.current_stage === 'backfill' && (
          <BackfillMode
            day={day}
            words={words}
            onWordsChange={loadDay}
            onDayChange={loadDay}
          />
        )}
        {day.current_stage === 'new-discovery' && (
          <NewDiscoveryMode
            day={day}
            words={words}
            onWordsChange={loadDay}
          />
        )}
      </div>

      {showHelp && (
        <KeyboardHelp
          stage={day.current_stage}
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
}
