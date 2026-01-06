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
  onRegister: (values: number[]) => void;
  onSkip: () => void;
  onBack: () => void;
  onFinish: () => void;
  canGoBack: boolean;
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
}: MeasurementInputProps) {
  const [values, setValues] = useState<number[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const MIN_VALUES = 5;
  const MAX_VALUES = 10;
  
  const average = values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : 0;
  
  const canRegister = values.length >= MIN_VALUES;
  const isFull = values.length >= MAX_VALUES;

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
      onRegister(values);
      setValues([]);
      setInputBuffer('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white shadow p-4">
        <div className="flex justify-between items-center">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${categoryColors[category]}`}>
            {categoryLabels[category]}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{instrument}</span>
            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200"
              title={isFullscreen ? '全画面解除' : '全画面表示'}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m6-6l5-5m0 0v4m0-4h-4" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <h1 className="text-xl font-bold mt-2">{pointName}</h1>
        <div className="text-sm text-gray-500 mt-1">
          狙い値: {targetValue}μm
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* ゲージ */}
        <Gauge
          value={average}
          targetValue={targetValue}
          lowerLimitPercent={lowerLimitPercent}
          upperLimitPercent={upperLimitPercent}
        />
        
        {/* 測定値リスト */}
        <ValueList
          values={values}
          onDelete={handleDeleteValue}
          maxValues={MAX_VALUES}
          minValues={MIN_VALUES}
        />
        
        {/* 入力中の値表示 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-center">
            <span className="text-sm text-gray-500">入力中</span>
            <div className="text-4xl font-bold h-12 flex items-center justify-center">
              {inputBuffer || <span className="text-gray-300">---</span>}
            </div>
            <span className="text-sm text-gray-500">μm</span>
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
      </main>

      {/* フッター（ナビゲーション） */}
      <footer className="bg-white shadow-lg p-4 space-y-2">
        <button
          onClick={handleRegister}
          disabled={!canRegister}
          className={`
            w-full h-14 rounded-lg text-lg font-bold
            ${canRegister 
              ? 'bg-green-500 text-white active:bg-green-600' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          登録して次へ
        </button>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={`
              flex-1 h-12 rounded-lg font-bold
              ${canGoBack 
                ? 'bg-gray-200 text-gray-700 active:bg-gray-300' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            戻る
          </button>
          <button
            onClick={onSkip}
            className="flex-1 h-12 rounded-lg font-bold bg-gray-200 text-gray-700 active:bg-gray-300"
          >
            スキップ
          </button>
        </div>
        <button
          onClick={onFinish}
          className="w-full h-10 rounded-lg font-bold text-sm bg-orange-100 text-orange-700 active:bg-orange-200"
        >
          測定を終了する
        </button>
      </footer>
    </div>
  );
}
