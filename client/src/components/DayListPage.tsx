import { useState, useEffect } from 'react';
import { api, Day } from '../api';
import { showToast } from './Toast';

interface Props {
  onSelectDay: (date: string) => void;
}

export function DayListPage({ onSelectDay }: Props) {
  const [days, setDays] = useState<Day[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [letterInput, setLetterInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDays();
  }, []);

  async function loadDays() {
    try {
      const data = await api.listDays();
      setDays(data);
    } catch (e: any) {
      showToast(e.message, 'warning');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const letters = letterInput.toUpperCase().split('').filter(l => /[A-Z]/.test(l));
    if (letters.length !== 7) {
      showToast('Enter exactly 7 letters (center letter first)', 'warning');
      return;
    }
    const unique = new Set(letters);
    if (unique.size !== 7) {
      showToast('All 7 letters must be unique', 'warning');
      return;
    }

    try {
      await api.createDay(date, letters);
      showToast('Day created!', 'success');
      setShowCreate(false);
      setLetterInput('');
      await loadDays();
      onSelectDay(date);
    } catch (e: any) {
      showToast(e.message, 'warning');
    }
  }

  const stageLabels: Record<string, string> = {
    'pre-pangram': 'Pre-Pangram',
    'backfill': 'Backfill',
    'new-discovery': 'New Discovery',
  };

  const stageColors: Record<string, string> = {
    'pre-pangram': 'bg-amber-100 text-amber-800',
    'backfill': 'bg-blue-100 text-blue-800',
    'new-discovery': 'bg-green-100 text-green-800',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Spelling Bee Tracker</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-bee-yellow text-bee-dark font-semibold rounded-lg hover:bg-bee-gold transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New Day'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border p-4 mb-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-bee-yellow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Letters (7, center letter first)
            </label>
            <input
              type="text"
              value={letterInput}
              onChange={e => setLetterInput(e.target.value.slice(0, 7))}
              placeholder="e.g. TIAOLKC"
              maxLength={7}
              className="px-3 py-2 border border-gray-300 rounded-lg w-full font-mono uppercase text-lg tracking-widest
                focus:outline-none focus:ring-2 focus:ring-bee-yellow"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              First letter = center letter (required in every word)
            </p>
          </div>
          <button
            type="submit"
            disabled={letterInput.length !== 7}
            className="w-full py-2 bg-bee-yellow text-bee-dark font-semibold rounded-lg hover:bg-bee-gold disabled:opacity-50"
          >
            Start Day
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-8">Loading...</div>
      ) : days.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No puzzle days yet</p>
          <p className="text-sm mt-2">Click "+ New Day" to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map(day => (
            <button
              key={day.id}
              onClick={() => onSelectDay(day.date)}
              className="w-full bg-white rounded-xl shadow-sm border p-4 hover:border-bee-yellow transition-colors text-left flex items-center gap-4"
            >
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{day.date}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-bee-yellow text-bee-dark font-bold text-xs">
                      {day.center_letter}
                    </span>
                    {day.letters.filter(l => l !== day.center_letter).map(l => (
                      <span key={l} className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-200 text-gray-700 font-medium text-xs">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[day.current_stage]}`}>
                  {stageLabels[day.current_stage]}
                </span>
                {day.genius_achieved && (
                  <span className="text-xs text-amber-600 font-medium">Genius</span>
                )}
                <span className="text-sm text-gray-500">{day.word_count} words</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
