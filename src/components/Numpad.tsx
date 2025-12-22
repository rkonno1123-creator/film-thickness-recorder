'use client';

interface NumpadProps {
  onInput: (value: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export default function Numpad({ onInput, onDelete, onClear, onConfirm, disabled }: NumpadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ];

  const handleKeyPress = (key: string) => {
    if (disabled) return;
    
    if (key === 'C') {
      onClear();
    } else if (key === '⌫') {
      onDelete();
    } else {
      onInput(key);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((key, index) => (
          <button
            key={index}
            onClick={() => handleKeyPress(key)}
            disabled={disabled}
            className={`
              h-14 text-2xl font-bold rounded-lg
              transition-all active:scale-95
              ${key === 'C' 
                ? 'bg-orange-500 text-white active:bg-orange-600' 
                : key === '⌫' 
                  ? 'bg-gray-400 text-white active:bg-gray-500'
                  : 'bg-gray-200 text-gray-800 active:bg-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {key}
          </button>
        ))}
      </div>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className={`
          w-full h-14 mt-2 text-xl font-bold rounded-lg
          bg-blue-500 text-white active:bg-blue-600
          transition-all active:scale-95
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        追加
      </button>
    </div>
  );
}
