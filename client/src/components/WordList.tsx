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
      {words.map((word, index) => {
        const isSelected = word.id === selectedWordId;
        const isInsertTarget = insertAfterWordId === word.id;
        const isInserted = word.inserted_after_word_id != null;
        const isMirrored = word.status_from_word_id != null;

        return (
          <div
            key={word.id}
            data-testid="word-item"
            className={`group flex items-center gap-2 px-3 py-1.5 rounded text-sm font-mono
              ${isInserted ? 'ml-4' : ''}
            `}
          >
            <div
              onClick={() => !isMirrored && onWordClick?.(word)}
              className={`flex items-center gap-2 flex-1 min-w-0
                ${isSelected ? 'ring-2 ring-bee-yellow bg-yellow-50 rounded px-1 -mx-1' : ''}
                ${isMirrored && word.status === 'rejected' ? 'text-red-400/40 line-through' : ''}
                ${isMirrored && word.status === 'accepted' ? 'text-green-700/40' : ''}
                ${!isMirrored && word.status === 'rejected' ? 'text-red-400 line-through' : ''}
                ${!isMirrored && word.status === 'accepted' ? 'text-green-700' : ''}
                ${word.status === 'pending' ? 'text-gray-700' : ''}
                ${word.is_pangram ? 'font-bold' : ''}
                ${isMirrored ? 'cursor-default' : onWordClick ? 'cursor-pointer' : ''}
              `}
            >
              {isInserted && (
                <span className="text-gray-300 text-xs shrink-0">&#8627;</span>
              )}
              <span className={`text-xs w-6 text-right shrink-0 ${isInserted ? 'text-gray-300' : 'text-gray-400'}`}>
                {index + 1}.
              </span>
              <span className={`flex-1 truncate ${isInserted ? 'opacity-85' : ''}`}>{word.word}</span>
              {word.is_pangram && <span className="text-xs text-amber-500 shrink-0" title="Pangram">&#9733;</span>}
              {word.status === 'accepted' && word.points != null && !isMirrored && (
                <span className="text-xs text-green-600 font-medium shrink-0">{word.points} pts</span>
              )}
              {word.status === 'accepted' && (word.points == null || isMirrored) && (
                <span className={`text-xs shrink-0 ${isMirrored ? 'text-green-500/40' : 'text-green-500'}`}>&#10003;</span>
              )}
              {word.status === 'rejected' && (
                <span className={`text-xs shrink-0 ${isMirrored ? 'text-red-400/40' : 'text-red-400'}`}>&#10007;</span>
              )}
            </div>
            {onInsertClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertClick(word.id);
                }}
                className={`text-xs leading-none shrink-0 w-5 h-5 flex items-center justify-center rounded transition-all
                  ${isInsertTarget
                    ? 'text-bee-gold bg-yellow-100 opacity-100 font-bold'
                    : 'text-gray-300 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-gray-500'}
                `}
                title="Insert word after this one"
              >
                +
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
