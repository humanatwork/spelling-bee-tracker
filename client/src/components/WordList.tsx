import { Word } from '../api';

interface Props {
  words: Word[];
  highlightId?: number | null;
  cursorId?: number | null;
  pulsingId?: number | null;
  onWordClick?: (word: Word) => void;
  compact?: boolean;
}

export function WordList({ words, highlightId, cursorId, pulsingId, onWordClick, compact }: Props) {
  if (words.length === 0) {
    return <div className="text-gray-400 text-sm italic py-4">No words yet</div>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {words.map((word, index) => {
        const isCursor = word.id === cursorId;
        const isPulsing = word.id === pulsingId;
        const isHighlight = word.id === highlightId;

        const statusClass =
          word.status === 'accepted' ? 'word-accepted' :
          word.status === 'rejected' ? 'word-rejected' :
          word.status === 'scratch' ? 'word-scratch' :
          'word-pending';

        const pangramClass = word.is_pangram ? 'word-pangram' : '';

        return (
          <div
            key={word.id}
            onClick={() => onWordClick?.(word)}
            className={`flex items-center gap-2 px-2 py-0.5 rounded text-sm font-mono
              ${statusClass} ${pangramClass}
              ${isCursor ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
              ${isHighlight ? 'bg-amber-50 ring-1 ring-amber-300' : ''}
              ${isPulsing ? 'animate-pulse bg-amber-100' : ''}
              ${onWordClick ? 'cursor-pointer hover:bg-gray-100' : ''}
              ${word.chain_depth > 0 ? `ml-${Math.min(word.chain_depth * 4, 16)}` : ''}
              ${compact ? 'py-0' : ''}
            `}
          >
            <span className="text-gray-400 text-xs w-6 text-right">{index + 1}.</span>
            <span className="flex-1">{word.word}</span>
            {word.is_pangram && <span className="text-xs" title="Pangram">&#11088;</span>}
            {word.attempt_count > 1 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium"
                title={`Entered ${word.attempt_count} times (attractor)`}
              >
                &times;{word.attempt_count}
              </span>
            )}
            {word.inspired_by_ids.length > 0 && (
              <span className="text-xs text-purple-500" title="Inspired by another word">&larr;</span>
            )}
            {word.status === 'rejected' && (
              <span className="text-xs text-red-400">REJ</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
