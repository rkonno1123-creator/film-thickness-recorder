'use client';

import { useState, useEffect, useCallback } from 'react';
import Numpad from './Numpad';
import Gauge from './Gauge';
import ValueList from './ValueList';

interface MeasurementInputProps {
  pointName: string;
  category: 'general' | 'extra' | 'special' | 'splice';
  layerNumber: number;
  targetValue: number;
  lowerLimitPercent: number;
  upperLimitPercent: number;
  instrument: string;
  onRegister: (values: number[], memo: string) => void;
  onSkip: () => void;
  onBack: () => void;
  onFinish: () => void;
  canGoBack: boolean;
  isAdditionalMode?: boolean;
}

const categoryLabels = {
  general: '一般部',
  extra: '増塗部',
  special: '特殊部',
  splice: '添接板',
};

const categoryColors = {
  general: 'bg-blue-100 text-blue-800',
  extra: 'bg-purple-100 text-purple-800',
  special: 'bg-orange-100 text-orange-800',
  splice: 'bg-green-100 text-green-800',
};

export default function MeasurementInput({
  pointName,
  category,
  layerNumber,
  targetValue,
  lowerLimitPercent,
  upperLimitPercent,
  instrument,
  onRegister,
  onSkip,
  onBack,
  onFinish,
  canGoBack,
  isAdditionalMode = false,
}: MeasurementInputProps) {
  const [values, setValues] = useState<number[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [memo, setMemo] = useState('');
  
  const MIN_VALUES = 5;
  const MAX_VALUES = 10;
  
  const average = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : 0;
  
  const canRegister = values.length >= MIN_VALUES;
  const isFull = values.length >= MAX_VALUES;
  const hasData = values.length > 0;
  const needMorePoints = MIN_VALUES - values.length;

  // 測定箇所が変わったら画面を一番上にスクロール & 入力をリセット
  useEffect(() => {
    window.scrollTo(0, 0);
    setValues([]);
    setInputBuffer('');
    setMemo('');
  }, [pointName]);

  // 全画面状態の監視
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 全画面切り替え
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // テンキー入力
  const handleInput = (digit: string) => {
    if (inputBuffer.length < 4) {
      setInputBuffer(prev => prev + digit);
    }
  };
  
  // 1文字削除
  const handleDelete = () => {
    setInputBuffer(prev => prev.slice(0, -1));
  };
  
  // クリア
  const handleClear = () => {
    setInputBuffer('');
  };
  
  // 値を追加
  const handleConfirm = () => {
    if (inputBuffer && !isFull) {
      const value = parseInt(inputBuffer, 10);
      if (value > 0) {
        setValues(prev => [...prev, value]);
        setInputBuffer('');
      }
    }
  };
  
  // 値を削除
  const handleDeleteValue = (index: number) => {
    setValues(prev => prev.filter((_, i) => i !== index));
  };
  
  // 登録
  const handleRegister = () => {
    if (canRegister) {
      onRegister(values, memo);
      // リセットはuseEffect[pointName]で行う
    }
  };

  // ページ離脱時の確認（データ入力中の場合）
  const confirmLeave = (action: () => void, actionName: string) => {
    if (!hasData) {
      // データなし → そのまま実行
      action();
      return;
    }

    // データあり → 登録するか確認
    const wantToSave = confirm(`${values.length}点のデータがあります。登録しますか？\n\n[OK] → 登録を試みる\n[キャンセル] → データを破棄して${actionName}`);
    
    if (wantToSave) {
      // 登録したい
      if (canRegister) {
        // 5点以上 → 登録して移動
        onRegister(values, memo);
        // リセットはuseEffect[pointName]で行う
      } else {
        // 5点未満 → 登録できない
        alert(`あと${needMorePoints}点測定してください。\n（最低5点必要です）`);
        // 何もしない（画面にとどまる）
      }
    } else {
      // 破棄して移動
      setValues([]);
      setInputBuffer('');
      setMemo('');
      action();
    }
  };

  // スキップ
  const handleSkipClick = () => {
    confirmLeave(onSkip, 'スキップ');
  };

  // 戻る
  const handleBackClick = () => {
    if (!canGoBack) return;
    confirmLeave(onBack, '戻る');
  };

  // 終了
  const handleFinishClick = () => {
    confirmLeave(onFinish, '終了');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ヘッダー（コンパクト） */}
      <header className="bg-white shadow px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${categoryColors[category]}`}>
              {categoryLabels[category]}
            </span>
            <span className="font-bold text-base truncate max-w-[180px]">{pointName}</span>
            {isAdditionalMode && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                追加
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{instrument}</span>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200"
              title={isFullscreen ? '全画面解除' : '全画面表示'}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m6-6l5-5m0 0v4m0-4h-4" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 p-3 space-y-3 overflow-auto">
        {/* ゲージ（コンパクト版） */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">狙い: {targetValue}μm</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{average > 0 ? average.toFixed(1) : '-'}</span>
              <span className="text-xs text-gray-500">μm</span>
              <span className={`px-2 py-0.5 text-xs font-bold text-white rounded ${
                average === 0 ? 'bg-gray-400' :
                average >= targetValue * (lowerLimitPercent / 100) && average <= targetValue * (upperLimitPercent / 100) ? 'bg-green-500' :
                average < targetValue * (lowerLimitPercent / 100) ? 'bg-blue-500' : 'bg-red-500'
              }`}>
                {average === 0 ? '-' : 
                 average >= targetValue * (lowerLimitPercent / 100) && average <= targetValue * (upperLimitPercent / 100) ? '適正' :
                 average < targetValue * (lowerLimitPercent / 100) ? '低い' : '高い'}
              </span>
            </div>
          </div>
          <Gauge
            value={average}
            targetValue={targetValue}
            lowerLimitPercent={lowerLimitPercent}
            upperLimitPercent={upperLimitPercent}
          />
        </div>
        
        {/* 入力中の値表示 + カウント */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-3xl font-bold h-10 flex items-center justify-center">
                {inputBuffer || <span className="text-gray-300">---</span>}
              </div>
              <span className="text-xs text-gray-500">μm</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">{values.length}/{MAX_VALUES}</div>
              <span className="text-xs text-gray-500">
                {values.length < MIN_VALUES ? `あと${needMorePoints}点` : '登録可'}
              </span>
            </div>
          </div>
        </div>
        
        {/* テンキー */}
        <Numpad
          onInput={handleInput}
          onDelete={handleDelete}
          onClear={handleClear}
          onConfirm={handleConfirm}
          disabled={isFull}
        />

        {/* 測定値リスト */}
        <ValueList
          values={values}
          onDelete={handleDeleteValue}
          maxValues={MAX_VALUES}
          minValues={MIN_VALUES}
        />

        {/* メモ欄 */}
        <div className="bg-white rounded-lg shadow p-3">
          <label className="block text-xs text-gray-500 mb-1">
            📝 メモ（任意）
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: キャリブレーションやり直し、ダミーデータ"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </main>

      {/* フッター（コンパクト） */}
      <footer className="bg-white shadow-lg p-3 space-y-2">
        <button
          onClick={handleRegister}
          disabled={!canRegister}
          className={`
            w-full h-12 rounded-lg text-lg font-bold
            ${canRegister 
              ? 'bg-green-500 text-white active:bg-green-600' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          登録して次へ ({values.length}点)
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleBackClick}
            disabled={!canGoBack}
            className={`
              flex-1 h-10 rounded-lg font-bold text-sm
              ${canGoBack 
                ? 'bg-gray-200 text-gray-700 active:bg-gray-300' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            戻る
          </button>
          <button
            onClick={handleSkipClick}
            className="flex-1 h-10 rounded-lg font-bold text-sm bg-gray-200 text-gray-700 active:bg-gray-300"
          >
            スキップ
          </button>
          <button
            onClick={handleFinishClick}
            className="flex-1 h-10 rounded-lg font-bold text-sm bg-orange-100 text-orange-700 active:bg-orange-200"
          >
            終了
          </button>
        </div>
      </footer>
    </div>
  );
}
