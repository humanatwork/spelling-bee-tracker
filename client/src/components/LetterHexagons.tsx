interface Props {
  letters: string[];
  centerLetter: string;
}

export function LetterHexagons({ letters, centerLetter }: Props) {
  const outer = letters.filter(l => l !== centerLetter);

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-bee-yellow text-bee-dark font-bold text-sm">
        {centerLetter}
      </span>
      {outer.map(letter => (
        <span
          key={letter}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-bee-gray text-bee-dark font-medium text-sm"
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
