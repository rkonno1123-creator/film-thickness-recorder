'use client';

interface GaugeProps {
  value: number;
  targetValue: number;
  lowerLimitPercent: number;
  upperLimitPercent: number;
}

export default function Gauge({ value, targetValue, lowerLimitPercent, upperLimitPercent }: GaugeProps) {
  const lowerLimit = targetValue * (lowerLimitPercent / 100);
  const upperLimit = targetValue * (upperLimitPercent / 100);
  
  // ゲージの範囲を計算（下限の80%〜上限の120%）
  const gaugeMin = lowerLimit * 0.8;
  const gaugeMax = upperLimit * 1.2;
  const gaugeRange = gaugeMax - gaugeMin;
  
  // 値の位置を%で計算
  const valuePosition = Math.max(0, Math.min(100, ((value - gaugeMin) / gaugeRange) * 100));
  const targetPosition = ((targetValue - gaugeMin) / gaugeRange) * 100;
  const lowerPosition = ((lowerLimit - gaugeMin) / gaugeRange) * 100;
  const upperPosition = ((upperLimit - gaugeMin) / gaugeRange) * 100;
  
  // 判定
  const isInRange = value >= lowerLimit && value <= upperLimit;
  const isLow = value < lowerLimit;
  const isHigh = value > upperLimit;
  
  const getStatusColor = () => {
    if (value === 0) return 'bg-gray-400';
    if (isInRange) return 'bg-green-500';
    if (isLow) return 'bg-blue-500';
    return 'bg-red-500';
  };
  
  const getStatusText = () => {
    if (value === 0) return '-';
    if (isInRange) return '適正';
    if (isLow) return '低い';
    return '高い';
  };

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      {/* 現在値と判定 */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600">平均値</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{value > 0 ? value.toFixed(1) : '-'}</span>
          <span className="text-sm text-gray-500">μm</span>
          <span className={`px-2 py-1 text-xs font-bold text-white rounded ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
      
      {/* ゲージバー */}
      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
        {/* 適正範囲 */}
        <div 
          className="absolute h-full bg-green-200"
          style={{ 
            left: `${lowerPosition}%`, 
            width: `${upperPosition - lowerPosition}%` 
          }}
        />
        
        {/* 下限ライン */}
        <div 
          className="absolute h-full w-0.5 bg-blue-500"
          style={{ left: `${lowerPosition}%` }}
        />
        
        {/* 狙い値ライン */}
        <div 
          className="absolute h-full w-1 bg-green-600"
          style={{ left: `${targetPosition}%` }}
        />
        
        {/* 上限ライン */}
        <div 
          className="absolute h-full w-0.5 bg-red-500"
          style={{ left: `${upperPosition}%` }}
        />
        
        {/* 現在値マーカー */}
        {value > 0 && (
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow ${getStatusColor()}`}
            style={{ left: `calc(${valuePosition}% - 8px)` }}
          />
        )}
      </div>
      
      {/* ラベル */}
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{lowerLimit.toFixed(0)}</span>
        <span className="text-green-600 font-bold">{targetValue}</span>
        <span>{upperLimit.toFixed(0)}</span>
      </div>
    </div>
  );
}
