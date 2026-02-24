interface Props {
  onClose: () => void;
}

export function KeyboardHelp({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="space-y-3 text-sm">
          <Row k="Enter" desc="Submit word (when input focused)" />
          <Row k="Escape" desc="Back to day list / cancel action" />
          <Row k="?" desc="Show this help" />
        </div>
      </div>
    </div>
  );
}

function Row({ k, desc }: { k: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono min-w-[2rem] text-center">
        {k}
      </kbd>
      <span className="text-gray-600">{desc}</span>
    </div>
  );
}
