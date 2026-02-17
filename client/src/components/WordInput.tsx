import { useState, useRef, useEffect } from 'react';

interface Props {
  onSubmit: (word: string) => void;
  letters?: string[];
  centerLetter?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function WordInput({ onSubmit, letters, centerLetter, placeholder = 'Type a word...', autoFocus = true, disabled = false }: Props) {
  const [value, setValue] = useState('');
  const [warning, setWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function validate(word: string): string {
    if (!letters || !centerLetter) return '';
    const upper = word.toUpperCase();
    if (upper.length > 0 && upper.length < 4) return 'Too short (min 4 letters)';
    if (upper.length < 4) return '';
    const letterSet = new Set(letters.map(l => l.toUpperCase()));

    if (!upper.includes(centerLetter.toUpperCase())) {
      return `Missing center letter ${centerLetter}`;
    }

    for (const char of upper) {
      if (!letterSet.has(char)) {
        return `'${char}' not in today's letters`;
      }
    }
    return '';
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    setWarning(validate(v));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.length < 4) return;
    onSubmit(trimmed);
    setValue('');
    setWarning('');
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          data-testid="word-input"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-lg font-mono uppercase
            focus:outline-none focus:ring-2 focus:ring-bee-yellow focus:border-transparent
            disabled:opacity-50 disabled:bg-gray-100"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-bee-yellow text-bee-dark font-semibold rounded-lg
            hover:bg-bee-gold transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {warning && (
        <span data-testid="validation-warning" className="text-xs text-amber-600">{warning} (soft warning — submit anyway)</span>
      )}
    </form>
  );
}
