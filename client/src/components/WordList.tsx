import { Word } from '../api';

interface Props {
  words: Word[];
  selectedWordId?: number | null;
  insertAfterWordId?: number | null;
  onWordClick?: (word: Word) => void;
  onInsertClick?: (afterWordId: number | null) => void;
}

export function WordList({ words, selectedWordId, insertAfterWordId, onWordClick, onInsertClick }: Props) {
  if (words.length === 0) {
    return <div className="text-gray-400 text-sm italic py-4">No words yet</div>;
  }

  return (
    <div data-testid="word-list" className="flex flex-col">
      {/* Insert at top button */}
      {onInsertClick && (
        <InsertButton
          active={insertAfterWordId === null}
          onClick={() => onInsertClick(null)}
        />
      )}
      {words.map((word, index) => {
        const isSelected = word.id === selectedWordId;

        return (
          <div key={word.id}>
            <div
              data-testid="word-item"
              onClick={() => onWordClick?.(word)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-mono
                ${isSelected ? 'ring-2 ring-bee-yellow bg-yellow-50' : ''}
                ${word.status === 'rejected' ? 'text-red-400 line-through' : ''}
                ${word.status === 'accepted' ? 'text-green-700' : ''}
                ${word.status === 'pending' ? 'text-gray-700' : ''}
                ${word.is_pangram ? 'font-bold' : ''}
                ${onWordClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              `}
            >
              <span className="text-gray-400 text-xs w-6 text-right">{index + 1}.</span>
              <span className="flex-1">{word.word}</span>
              {word.is_pangram && <span className="text-xs text-amber-500" title="Pangram">&#9733;</span>}
              {word.status === 'accepted' && word.points != null && (
                <span className="text-xs text-green-600 font-medium">{word.points} pts</span>
              )}
              {word.status === 'accepted' && word.points == null && (
                <span className="text-xs text-green-500">&#10003;</span>
              )}
              {word.status === 'rejected' && (
                <span className="text-xs text-red-400">&#10007;</span>
              )}
            </div>
            {/* Insert-after button */}
            {onInsertClick && (
              <InsertButton
                active={insertAfterWordId === word.id}
                onClick={() => onInsertClick(word.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InsertButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-center py-0.5 text-xs transition-all
        ${active
          ? 'text-bee-gold bg-yellow-50 font-medium'
          : 'text-gray-300 hover:text-gray-500 opacity-0 hover:opacity-100'}
      `}
    >
      {active ? '[ inserting here ]' : '[+]'}
    </button>
  );
}
