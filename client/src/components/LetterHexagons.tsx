interface Props {
  letters: string[];
  centerLetter: string;
  onLetterClick?: (letter: string) => void;
  size?: 'sm' | 'lg';
}

function Hexagon({
  letter,
  isCenter,
  onClick,
  size,
}: {
  letter: string;
  isCenter: boolean;
  onClick?: () => void;
  size: 'sm' | 'lg';
}) {
  const dims = size === 'lg' ? 'w-16 h-[72px]' : 'w-8 h-9';
  const fontSize = size === 'lg' ? 'text-2xl' : 'text-sm';
  const bg = isCenter ? 'bg-bee-yellow' : 'bg-bee-gray';
  const hover = onClick ? 'cursor-pointer hover:brightness-90 active:brightness-75 transition-all' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${dims} ${bg} ${hover} ${fontSize} font-bold text-bee-dark
        flex items-center justify-center select-none`}
      style={{
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      }}
      tabIndex={onClick ? 0 : -1}
    >
      {letter}
    </button>
  );
}

export function LetterHexagons({ letters, centerLetter, onLetterClick, size = 'sm' }: Props) {
  const outer = letters.filter(l => l !== centerLetter);

  if (size === 'sm') {
    // Compact inline display for list page
    return (
      <div className="flex items-center gap-0.5">
        <Hexagon letter={centerLetter} isCenter size="sm" />
        {outer.map(letter => (
          <Hexagon key={letter} letter={letter} isCenter={false} size="sm" />
        ))}
      </div>
    );
  }

  // Large beehive layout:
  //     [1]  [2]
  //   [0]  [C]  [3]
  //     [5]  [4]
  const gap = size === 'lg' ? '-mx-1' : '-mx-0.5';
  const rowGap = size === 'lg' ? '-my-2' : '-my-1';

  return (
    <div className={`flex flex-col items-center ${rowGap}`}>
      {/* Top row: outer[1], outer[2] */}
      <div className={`flex ${gap}`}>
        <Hexagon
          letter={outer[1] || ''}
          isCenter={false}
          onClick={onLetterClick ? () => onLetterClick(outer[1]) : undefined}
          size="lg"
        />
        <Hexagon
          letter={outer[2] || ''}
          isCenter={false}
          onClick={onLetterClick ? () => onLetterClick(outer[2]) : undefined}
          size="lg"
        />
      </div>
      {/* Middle row: outer[0], center, outer[3] */}
      <div className={`flex ${gap}`}>
        <Hexagon
          letter={outer[0] || ''}
          isCenter={false}
          onClick={onLetterClick ? () => onLetterClick(outer[0]) : undefined}
          size="lg"
        />
        <Hexagon
          letter={centerLetter}
          isCenter
          onClick={onLetterClick ? () => onLetterClick(centerLetter) : undefined}
          size="lg"
        />
        <Hexagon
          letter={outer[3] || ''}
          isCenter={false}
          onClick={onLetterClick ? () => onLetterClick(outer[3]) : undefined}
          size="lg"
        />
      </div>
      {/* Bottom row: outer[5], outer[4] */}
      <div className={`flex ${gap}`}>
        <Hexagon
          letter={outer[5] || ''}
          isCenter={false}
          onClick={onLetterClick ? () => onLetterClick(outer[5]) : undefined}
          size="lg"
        />
        <Hexagon
          letter={outer[4] || ''}
          isCenter={false}
          onClick={onLetterClick ? () => onLetterClick(outer[4]) : undefined}
          size="lg"
        />
      </div>
    </div>
  );
}
