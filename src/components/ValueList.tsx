'use client';

interface ValueListProps {
  values: number[];
  onDelete: (index: number) => void;
  maxValues: number;
  minValues: number;
}

export default function ValueList({ values, onDelete, maxValues, minValues }: ValueListProps) {
  const average = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : 0;
  
  const canRegister = values.length >= minValues;
  const isFull = values.length >= maxValues;

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-gray-600">
          測定値 ({values.length}/{maxValues})
        </span>
        {canRegister && (
          <span className="text-xs text-green-600">✓ 登録可能</span>
        )}
      </div>
      
      {/* 測定値グリッド */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {Array.from({ length: maxValues }).map((_, index) => (
          <div
            key={index}
            className={`
              relative h-12 flex items-center justify-center rounded-lg text-lg font-bold
              ${index < values.length 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300'
              }
            `}
          >
            {index < values.length ? (
              <>
                {values[index]}
                <button
                  onClick={() => onDelete(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                >
                  ×
                </button>
              </>
            ) : (
              <span className="text-sm">{index + 1}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* 状態表示 */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">
          {values.length < minValues 
            ? `あと${minValues - values.length}点必要` 
            : isFull 
              ? '入力完了' 
              : `あと${maxValues - values.length}点入力可`
          }
        </span>
        {values.length > 0 && (
          <span className="text-gray-600">
            平均: <span className="font-bold">{average.toFixed(1)}</span> μm
          </span>
        )}
      </div>
    </div>
  );
}
