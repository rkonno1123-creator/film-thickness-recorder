'use client';

import { useState, useEffect, useRef } from 'react';
import MeasurementInput from '@/components/MeasurementInput';
import { syncMeasurements } from '@/lib/firestore';

// 測定箇所の型
interface MeasurementPoint {
  id: string;
  name: string;
  category: 'general' | 'extra' | 'special' | 'splice';
  routeOrder: number;
}

// 保存済み測定データの型
interface SavedMeasurement {
  id: string;
  pointId: string;
  pointName: string;
  category: string;
  operator: string;
  instrument: string;
  values: number[];
  average: number;
  timestamp: string;
  synced: boolean;
  memo?: string; // メモ（任意）
}

// セッション情報
interface SessionInfo {
  operator: string;
  instrument: string;
  selectedInstruments: string[]; // 今日使う測定器リスト
  siteName: string; // 現場名
  siteId: string; // 現場ID
}

// 現場リスト
const SITES = [
  { id: 'maedagawa-nobori', name: '前田川 上り', file: '/sites/maedagawa-nobori.csv' },
  // { id: 'maedagawa-kudari', name: '前田川 下り', file: '/sites/maedagawa-kudari.csv' },
] as const;

// デモ用のダミーデータ（現場未選択時）
const defaultPoints: MeasurementPoint[] = [
  { id: '1', name: 'G1_主桁_①-1', category: 'general', routeOrder: 1 },
  { id: '2', name: 'G1_主桁_①-2', category: 'general', routeOrder: 2 },
  { id: '3', name: 'G1_主桁_①-3', category: 'general', routeOrder: 3 },
  { id: '4', name: 'G1_主桁_①-4', category: 'general', routeOrder: 4 },
  { id: '5', name: 'G2_主桁_①-1', category: 'extra', routeOrder: 5 },
  { id: '6', name: 'G2_主桁_①-2', category: 'extra', routeOrder: 6 },
  { id: '7', name: '対傾構_◆-1', category: 'special', routeOrder: 7 },
  { id: '8', name: '添接板_◎-1', category: 'splice', routeOrder: 8 },
];

const thresholds = {
  general: { target: 250, lower: 70, upper: 130 },
  extra: { target: 310, lower: 70, upper: 130 },
  special: { target: 490, lower: 70, upper: 130 },
  splice: { target: 300, lower: 70, upper: 130 },
};

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

// 測定器リスト
const INSTRUMENTS = ['Pro-W', 'LZ990', 'Elcometer'] as const;

// ユニークID生成
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

type ViewMode = 'setup' | 'list' | 'route' | 'measure' | 'summary';

export default function Home() {
  const [points, setPoints] = useState<MeasurementPoint[]>(defaultPoints);
  const [measurements, setMeasurements] = useState<SavedMeasurement[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({ 
    operator: '', 
    instrument: '',
    selectedInstruments: [],
    siteName: '',
    siteId: ''
  });
  const [tempOperator, setTempOperator] = useState('');
  const [tempInstrument, setTempInstrument] = useState('');
  const [tempSelectedInstruments, setTempSelectedInstruments] = useState<string[]>([]);
  const [tempSiteId, setTempSiteId] = useState('');
  const [showInstrumentModal, setShowInstrumentModal] = useState(false);
  const [pendingPointId, setPendingPointId] = useState<string | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<SavedMeasurement | null>(null);
  const [isLoadingSite, setIsLoadingSite] = useState(false);
  const [isAdditionalMode, setIsAdditionalMode] = useState(false); // 追加測定モード
  const listRef = useRef<HTMLDivElement>(null); // リストのスクロール位置保持用
  const [lastMeasuredPointId, setLastMeasuredPointId] = useState<string | null>(null); // 最後に測定した箇所

  // ローカルストレージから読み込み
  useEffect(() => {
    const stored = localStorage.getItem('measurements');
    if (stored) {
      setMeasurements(JSON.parse(stored));
    }
    const storedPoints = localStorage.getItem('measurementPoints');
    if (storedPoints) {
      setPoints(JSON.parse(storedPoints));
    }
    const storedSession = localStorage.getItem('sessionInfo');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      setSessionInfo({
        ...session,
        selectedInstruments: session.selectedInstruments || [],
        siteName: session.siteName || '',
        siteId: session.siteId || ''
      });
      setTempOperator(session.operator || '');
      setTempInstrument(session.instrument || '');
      setTempSelectedInstruments(session.selectedInstruments || []);
      setTempSiteId(session.siteId || '');
    }
  }, []);

  // リストに戻った時、最後に測定した箇所にスクロール
  useEffect(() => {
    if (viewMode === 'list' && lastMeasuredPointId && listRef.current) {
      const element = document.getElementById(`point-${lastMeasuredPointId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [viewMode, lastMeasuredPointId]);

  // 現在の測定箇所
  const currentPoint = viewMode === 'measure' && selectedPointId
    ? points.find(p => p.id === selectedPointId)
    : points[currentIndex];

  const threshold = currentPoint ? thresholds[currentPoint.category] : thresholds.general;

  // 指定した測定器で測定済みかチェック
  const isMeasuredWithInstrument = (pointId: string, instrument: string) => {
    return measurements.some(m => 
      m.pointId === pointId && 
      m.operator === sessionInfo.operator && 
      m.instrument === instrument
    );
  };

  // 選択した全測定器で測定完了かチェック
  const isFullyMeasured = (pointId: string) => {
    const targetInstruments = sessionInfo.selectedInstruments || [];
    if (targetInstruments.length === 0) return false;
    
    return targetInstruments.every(instrument => 
      isMeasuredWithInstrument(pointId, instrument)
    );
  };

  // 測定箇所の測定状況を取得（どの測定器で測定済みか）
  const getMeasurementStatus = (pointId: string) => {
    const targetInstruments = sessionInfo.selectedInstruments || [];
    const measured = targetInstruments.filter(instrument => 
      isMeasuredWithInstrument(pointId, instrument)
    );
    return {
      measured,
      total: targetInstruments.length,
      isComplete: measured.length === targetInstruments.length && targetInstruments.length > 0
    };
  };

  // 追加データの数を取得（同じ測定器で2回以上測定した分）
  const getAdditionalCount = (pointId: string) => {
    const pointMeasurements = measurements.filter(m => 
      m.pointId === pointId && 
      m.operator === sessionInfo.operator
    );
    
    // 測定器ごとにカウント
    const byInstrument: Record<string, number> = {};
    pointMeasurements.forEach(m => {
      byInstrument[m.instrument] = (byInstrument[m.instrument] || 0) + 1;
    });
    
    // 各測定器で2回目以降の分を合計
    let additionalCount = 0;
    Object.values(byInstrument).forEach(count => {
      if (count > 1) {
        additionalCount += count - 1;
      }
    });
    
    return additionalCount;
  };

  // その箇所が測定済みか（追加測定モード用）
  const hasMeasurement = (pointId: string) => {
    return measurements.some(m => 
      m.pointId === pointId && 
      m.operator === sessionInfo.operator
    );
  };

  // 現在のセッションの測定データを取得
  const getMeasurement = (pointId: string) => {
    return measurements.find(m => 
      m.pointId === pointId && 
      m.operator === sessionInfo.operator
    );
  };

  // 完了した箇所数
  const completedPointsCount = points.filter(p => isFullyMeasured(p.id)).length;

  // 未送信データ数
  const unsyncedCount = measurements.filter(m => !m.synced).length;

  // 測定器チェックボックスの切り替え
  const handleToggleInstrument = (instrument: string) => {
    setTempSelectedInstruments(prev => 
      prev.includes(instrument)
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
    );
  };

  // 現場選択時にCSVを読み込む
  const handleSiteChange = async (siteId: string) => {
    setTempSiteId(siteId);
    
    if (!siteId) {
      setPoints(defaultPoints);
      return;
    }

    const site = SITES.find(s => s.id === siteId);
    if (!site) return;

    setIsLoadingSite(true);
    try {
      const response = await fetch(site.file);
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      const dataLines = lines[0].includes('id') || lines[0].includes('name') 
        ? lines.slice(1) 
        : lines;
      
      const newPoints: MeasurementPoint[] = dataLines
        .filter(line => {
          const cols = line.split(',').map(col => col.trim());
          return cols[0] && cols[1]; // idとnameが両方あること
        })
        .map((line, index) => {
          const cols = line.split(',').map(col => col.trim());
          return {
            id: cols[0] || String(index + 1),
            name: cols[1] || cols[0],
            category: (cols[2] as MeasurementPoint['category']) || 'general',
            routeOrder: parseInt(cols[3]) || index + 1,
          };
        });

      setPoints(newPoints);
      localStorage.setItem('measurementPoints', JSON.stringify(newPoints));
    } catch (error) {
      console.error('Failed to load site CSV:', error);
      alert('現場データの読み込みに失敗しました');
    } finally {
      setIsLoadingSite(false);
    }
  };

  // セッション開始
  const handleStartSession = () => {
    if (!tempOperator.trim() || !tempInstrument.trim() || tempSelectedInstruments.length === 0 || !tempSiteId) return;
    
    const site = SITES.find(s => s.id === tempSiteId);
    const newSession: SessionInfo = { 
      operator: tempOperator.trim(), 
      instrument: tempInstrument.trim(),
      selectedInstruments: tempSelectedInstruments,
      siteName: site?.name || '',
      siteId: tempSiteId
    };
    setSessionInfo(newSession);
    localStorage.setItem('sessionInfo', JSON.stringify(newSession));
    setViewMode('list');
  };

  // CSV読み込み
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      const dataLines = lines[0].includes('id') || lines[0].includes('name') 
        ? lines.slice(1) 
        : lines;
      
      const newPoints: MeasurementPoint[] = dataLines
        .filter(line => {
          const cols = line.split(',').map(col => col.trim());
          return cols[0] && cols[1]; // idとnameが両方あること
        })
        .map((line, index) => {
          const cols = line.split(',').map(col => col.trim());
          return {
            id: cols[0] || String(index + 1),
            name: cols[1] || cols[0],
            category: (cols[2] as MeasurementPoint['category']) || 'general',
            routeOrder: parseInt(cols[3]) || index + 1,
          };
        });

      setPoints(newPoints);
      localStorage.setItem('measurementPoints', JSON.stringify(newPoints));
    };
    reader.readAsText(file);
  };

  // 測定登録（上書きしない、常に追加）
  const handleRegister = (values: number[], memo: string) => {
    if (!currentPoint) return;
    
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    
    const newMeasurement: SavedMeasurement = {
      id: generateId(),
      pointId: currentPoint.id,
      pointName: currentPoint.name,
      category: currentPoint.category,
      operator: sessionInfo.operator,
      instrument: sessionInfo.instrument,
      values,
      average,
      timestamp: new Date().toISOString(),
      synced: false,
      memo: memo || undefined, // 空文字の場合はundefined
    };

    const newMeasurements = [...measurements, newMeasurement];
    setMeasurements(newMeasurements);
    localStorage.setItem('measurements', JSON.stringify(newMeasurements));

    // 最後に測定した箇所を記録
    setLastMeasuredPointId(currentPoint.id);

    // 次へ進む
    if (viewMode === 'route') {
      if (currentIndex < points.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setViewMode('summary');
      }
    } else {
      // 追加測定モードの場合は追加モードのまま
      setViewMode('list');
      setSelectedPointId(null);
    }
  };

  // スキップ
  const handleSkip = () => {
    if (viewMode === 'route') {
      if (currentIndex < points.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setViewMode('summary');
      }
    } else {
      setViewMode('list');
      setSelectedPointId(null);
    }
  };

  // 戻る
  const handleBack = () => {
    if (viewMode === 'route' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setViewMode('list');
      setSelectedPointId(null);
    }
  };

  // 終了
  const handleFinish = () => {
    setViewMode('summary');
  };

  // ローカルデータリセット
  const handleReset = () => {
    if (confirm('ローカルの測定データをすべて削除しますか？')) {
      setMeasurements([]);
      localStorage.removeItem('measurements');
      setCurrentIndex(0);
      setViewMode('list');
    }
  };

  // 個別データ削除
  const handleDeleteMeasurement = (id: string) => {
    const newMeasurements = measurements.filter(m => m.id !== id);
    setMeasurements(newMeasurements);
    localStorage.setItem('measurements', JSON.stringify(newMeasurements));
  };

  // 箇所を選択して測定器選択モーダルを表示
  const handleSelectPoint = (pointId: string) => {
    const instruments = sessionInfo.selectedInstruments || [];
    
    // 追加測定モードの場合は常にモーダル表示（1台でも）
    if (isAdditionalMode) {
      setPendingPointId(pointId);
      setShowInstrumentModal(true);
      return;
    }
    
    // 通常モード：選択した測定器が1つだけなら直接測定画面へ
    if (instruments.length === 1) {
      const instrument = instruments[0];
      const newSession = { ...sessionInfo, instrument };
      setSessionInfo(newSession);
      localStorage.setItem('sessionInfo', JSON.stringify(newSession));
      setSelectedPointId(pointId);
      setViewMode('measure');
    } else {
      // 2つ以上ならモーダル表示
      setPendingPointId(pointId);
      setShowInstrumentModal(true);
    }
  };

  // 測定器を選択して測定開始
  const handleSelectInstrument = (instrument: string) => {
    if (!pendingPointId) return;
    
    const newSession = { ...sessionInfo, instrument };
    setSessionInfo(newSession);
    localStorage.setItem('sessionInfo', JSON.stringify(newSession));
    
    setSelectedPointId(pendingPointId);
    setShowInstrumentModal(false);
    setPendingPointId(null);
    setViewMode('measure');
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setShowInstrumentModal(false);
    setPendingPointId(null);
  };

  // ルートモード開始
  const handleStartRoute = () => {
    setCurrentIndex(0);
    setViewMode('route');
  };

  // 測定器変更
  const handleChangeInstrument = (measurementId: string, newInstrument: string) => {
    const newMeasurements = measurements.map(m => 
      m.id === measurementId ? { ...m, instrument: newInstrument } : m
    );
    setMeasurements(newMeasurements);
    localStorage.setItem('measurements', JSON.stringify(newMeasurements));
    setEditingMeasurement(null);
  };

  // クラウド送信（Firestoreに追記）
  const [isSyncing, setIsSyncing] = useState(false);
  
  const handleSync = async () => {
    if (isSyncing) return;
    
    const unsyncedData = measurements.filter(m => !m.synced);
    if (unsyncedData.length === 0) return;
    
    setIsSyncing(true);
    
    try {
      const result = await syncMeasurements(unsyncedData);
      
      if (result.success) {
        // 送信成功したらsyncedフラグを立てる
        const newMeasurements = measurements.map(m => 
          unsyncedData.some(u => u.id === m.id) ? { ...m, synced: true } : m
        );
        setMeasurements(newMeasurements);
        localStorage.setItem('measurements', JSON.stringify(newMeasurements));
        alert(`${result.count}件のデータを送信しました`);
      } else {
        alert(`送信エラー: ${result.error}`);
      }
    } catch (error) {
      alert('送信に失敗しました');
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  // JSONエクスポート
  const handleExport = () => {
    const data = JSON.stringify(measurements, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // CSVエクスポート
  const handleExportCSV = () => {
    const headers = ['ID', '箇所ID', '箇所名', '区分', '測定者', '測定器', '測定値', '平均値', '測定日時', '送信済み', 'メモ'];
    const rows = measurements.map(m => [
      m.id,
      m.pointId,
      m.pointName,
      categoryLabels[m.category as keyof typeof categoryLabels],
      m.operator,
      m.instrument,
      m.values.join(';'),
      m.average.toFixed(1),
      m.timestamp,
      m.synced ? '✓' : '',
      m.memo || '',
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // セットアップ画面
  if (viewMode === 'setup') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
          <h1 className="text-xl font-bold mb-6 text-center">膜厚測定記録</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                現場を選択
              </label>
              <select
                value={tempSiteId}
                onChange={(e) => handleSiteChange(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-lg bg-white"
                disabled={isLoadingSite}
              >
                <option value="">-- 現場を選択 --</option>
                {SITES.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              {isLoadingSite && (
                <p className="text-sm text-blue-500 mt-1">読み込み中...</p>
              )}
              {tempSiteId && !isLoadingSite && (
                <p className="text-sm text-green-600 mt-1">✓ {points.length}箇所 読み込み済み</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                測定者名
              </label>
              <input
                type="text"
                value={tempOperator}
                onChange={(e) => setTempOperator(e.target.value)}
                placeholder="例: 田中"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                測定器名（メモ用）
              </label>
              <input
                type="text"
                value={tempInstrument}
                onChange={(e) => setTempInstrument(e.target.value)}
                placeholder="例: 測定器A"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                今日使う測定器を選択
              </label>
              <div className="space-y-2">
                {INSTRUMENTS.map((instrument) => (
                  <label
                    key={instrument}
                    className={`
                      flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${tempSelectedInstruments.includes(instrument)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={tempSelectedInstruments.includes(instrument)}
                      onChange={() => handleToggleInstrument(instrument)}
                      className="w-5 h-5 text-blue-500 rounded"
                    />
                    <span className="ml-3 font-medium">{instrument}</span>
                  </label>
                ))}
              </div>
              {tempSelectedInstruments.length === 0 && (
                <p className="text-sm text-red-500 mt-1">※ 1つ以上選択してください</p>
              )}
            </div>
            
            <button
              onClick={handleStartSession}
              disabled={!tempSiteId || !tempOperator.trim() || !tempInstrument.trim() || tempSelectedInstruments.length === 0 || isLoadingSite}
              className={`
                w-full h-14 rounded-lg text-lg font-bold mt-4
                ${tempSiteId && tempOperator.trim() && tempInstrument.trim() && tempSelectedInstruments.length > 0 && !isLoadingSite
                  ? 'bg-blue-500 text-white active:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              測定を開始する
            </button>
          </div>
          
          {measurements.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500 text-center">
                保存済みデータ: {measurements.length}件
                {unsyncedCount > 0 && (
                  <span className="text-orange-500">（未送信: {unsyncedCount}件）</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // サマリー画面
  if (viewMode === 'summary') {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xl font-bold">測定結果</h1>
              <p className="text-sm text-gray-500">
                {sessionInfo.operator}
              </p>
            </div>
            <button
              onClick={() => setViewMode('setup')}
              className="text-sm text-blue-500"
            >
              設定変更
            </button>
          </div>
          
          <div className="flex gap-4 mb-4 text-sm">
            <div className="bg-gray-100 rounded p-2 flex-1 text-center">
              <div className="font-bold text-lg">{measurements.length}</div>
              <div className="text-gray-500">総データ数</div>
            </div>
            <div className="bg-orange-100 rounded p-2 flex-1 text-center">
              <div className="font-bold text-lg text-orange-600">{unsyncedCount}</div>
              <div className="text-gray-500">未送信</div>
            </div>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-auto">
            {measurements.map((m) => (
              <div 
                key={m.id} 
                className={`p-3 rounded flex justify-between items-start ${m.synced ? 'bg-green-50' : 'bg-gray-50'}`}
              >
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {m.pointName}
                    {m.synced && <span className="text-green-500 text-xs">送信済</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {m.operator} / {m.instrument}
                  </div>
                  <div className="text-sm text-gray-600">
                    平均: {m.average.toFixed(1)}μm ({m.values.length}点)
                  </div>
                  {m.memo && (
                    <div className="text-xs text-orange-600 mt-1">
                      📝 {m.memo}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {!m.synced && (
                    <>
                      <button
                        onClick={() => setEditingMeasurement(m)}
                        className="text-blue-400 text-sm px-2"
                      >
                        変更
                      </button>
                      <button
                        onClick={() => handleDeleteMeasurement(m.id)}
                        className="text-red-400 text-sm px-2"
                      >
                        削除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          {unsyncedCount > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`w-full h-14 rounded-lg font-bold ${isSyncing ? 'bg-gray-400 text-gray-200' : 'bg-orange-500 text-white'}`}
            >
              {isSyncing ? '送信中...' : `クラウドに送信（${unsyncedCount}件）`}
            </button>
          )}
          
          <button
            onClick={() => setViewMode('list')}
            className="w-full h-14 bg-blue-500 text-white rounded-lg font-bold"
          >
            箇所リストに戻る
          </button>
          
          <button
            onClick={handleExportCSV}
            className="w-full h-12 bg-green-500 text-white rounded-lg font-bold"
          >
            CSVエクスポート
          </button>
          
          <button
            onClick={handleExport}
            className="w-full h-10 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm"
          >
            JSONエクスポート
          </button>
          
          <button
            onClick={handleReset}
            className="w-full h-10 bg-red-100 text-red-700 rounded-lg font-bold text-sm"
          >
            ローカルデータを削除
          </button>
        </div>

        {/* 測定器変更モーダル */}
        {editingMeasurement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
              <div className="p-4 border-b">
                <h2 className="text-lg font-bold">測定器を変更</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingMeasurement.pointName}
                </p>
                <p className="text-xs text-gray-400">
                  現在: {editingMeasurement.instrument}
                </p>
              </div>
              <div className="p-4 space-y-2">
                {INSTRUMENTS.map((instrument) => (
                  <button
                    key={instrument}
                    onClick={() => handleChangeInstrument(editingMeasurement.id, instrument)}
                    className={`
                      w-full h-14 rounded-lg font-bold text-lg
                      ${instrument === editingMeasurement.instrument
                        ? 'bg-gray-300 text-gray-500'
                        : 'bg-blue-500 text-white active:bg-blue-600'
                      }
                    `}
                  >
                    {instrument}
                  </button>
                ))}
              </div>
              <div className="p-4 border-t">
                <button
                  onClick={() => setEditingMeasurement(null)}
                  className="w-full h-12 bg-gray-200 text-gray-700 rounded-lg font-bold"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 測定画面
  if ((viewMode === 'route' || viewMode === 'measure') && currentPoint) {
    return (
      <div>
        {viewMode === 'route' && (
          <div className="bg-white px-4 py-2 border-b">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>ルートモード</span>
              <span>{currentIndex + 1} / {points.length}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${((currentIndex + 1) / points.length) * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {viewMode === 'measure' && (
          <div className="bg-white px-4 py-2 border-b">
            <div className="text-sm text-gray-500">
              {sessionInfo.operator} / {sessionInfo.instrument}
              {isAdditionalMode && (
                <span className="ml-2 text-orange-600 font-bold">【追加測定】</span>
              )}
            </div>
          </div>
        )}
        
        <MeasurementInput
          pointName={currentPoint.name}
          category={currentPoint.category}
          layerNumber={3}
          targetValue={threshold.target}
          lowerLimitPercent={threshold.lower}
          upperLimitPercent={threshold.upper}
          instrument={sessionInfo.instrument}
          onRegister={handleRegister}
          onSkip={handleSkip}
          onBack={handleBack}
          onFinish={handleFinish}
          canGoBack={viewMode === 'route' ? currentIndex > 0 : true}
          isAdditionalMode={isAdditionalMode}
        />
      </div>
    );
  }

  // 箇所リスト画面
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">{sessionInfo.siteName || '膜厚測定記録'}</h1>
            <p className="text-sm text-gray-500">
              {sessionInfo.operator}
            </p>
            <p className="text-xs text-gray-400">
              使用測定器: {(sessionInfo.selectedInstruments || []).join(', ')}
            </p>
          </div>
          <button
            onClick={() => setViewMode('setup')}
            className="text-sm text-blue-500"
          >
            変更
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          完了: {completedPointsCount} / {points.length} 箇所
          {unsyncedCount > 0 && (
            <span className="text-orange-500 ml-2">（未送信: {unsyncedCount}件）</span>
          )}
        </p>
      </header>

      <div className="p-4 space-y-2">
        {!isAdditionalMode ? (
          <>
            <button
              onClick={handleStartRoute}
              className="w-full h-14 bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <span>▶</span> ルートモードで測定開始
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => setIsAdditionalMode(true)}
                className="flex-1 h-12 bg-orange-100 text-orange-700 rounded-lg font-bold text-sm"
              >
                + 追加測定
              </button>
              
              <button
                onClick={handleFinish}
                className="flex-1 h-12 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm"
              >
                結果を見る
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setIsAdditionalMode(false)}
            className="w-full h-12 bg-gray-200 text-gray-700 rounded-lg font-bold"
          >
            ← 通常モードに戻る
          </button>
        )}
      </div>

      <div className="px-4 pb-4" ref={listRef}>
        <h2 className="text-sm font-bold text-gray-600 mb-2">
          {isAdditionalMode ? '追加測定する箇所を選択（測定器を必ず選択）' : '測定箇所一覧'}
        </h2>
        <div className="space-y-2 max-h-[55vh] overflow-auto">
          {points
            .filter(point => !isAdditionalMode || hasMeasurement(point.id))
            .map((point) => {
              const status = getMeasurementStatus(point.id);
              const additionalCount = getAdditionalCount(point.id);
            
              return (
                <button
                  id={`point-${point.id}`}
                  key={point.id}
                  onClick={() => handleSelectPoint(point.id)}
                  className={`
                    w-full p-3 rounded-lg text-left flex items-center justify-between
                    ${status.isComplete ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'}
                    ${lastMeasuredPointId === point.id ? 'ring-2 ring-blue-400' : ''}
                  `}
                >
                  <div>
                    <div className="font-medium">{point.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[point.category]}`}>
                        {categoryLabels[point.category]}
                      </span>
                      {status.total > 0 && (
                        <span className="text-xs text-gray-500">
                          {status.measured.length}/{status.total}台
                        </span>
                      )}
                    </div>
                    {/* 測定済み測定器の表示 */}
                    {status.measured.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {status.measured.map(inst => (
                          <span key={inst} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {inst}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {status.isComplete && (
                      <span className="text-green-500 text-xl">✓</span>
                    )}
                    {additionalCount > 0 && (
                      <span className="text-blue-500 text-sm font-bold">+{additionalCount}</span>
                    )}
                    <span className="text-gray-400">›</span>
                  </div>
                </button>
              );
            })}
          {isAdditionalMode && points.filter(p => hasMeasurement(p.id)).length === 0 && (
            <p className="text-center text-gray-500 py-4">測定済みの箇所がありません</p>
          )}
        </div>
      </div>

      {/* 測定器選択モーダル */}
      {showInstrumentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold">測定器を選択</h2>
              <p className="text-sm text-gray-500 mt-1">
                {points.find(p => p.id === pendingPointId)?.name}
              </p>
              {isAdditionalMode && (
                <p className="text-xs text-orange-600 mt-1">
                  ※ 追加測定：測定器を選択してください
                </p>
              )}
            </div>
            <div className="p-4 space-y-2">
              {(isAdditionalMode ? INSTRUMENTS : sessionInfo.selectedInstruments || []).map((instrument) => {
                const alreadyMeasured = pendingPointId ? isMeasuredWithInstrument(pendingPointId, instrument) : false;
                return (
                  <button
                    key={instrument}
                    onClick={() => handleSelectInstrument(instrument)}
                    className={`
                      w-full h-14 rounded-lg font-bold text-lg flex items-center justify-center gap-2
                      ${alreadyMeasured 
                        ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                        : 'bg-blue-500 text-white active:bg-blue-600'
                      }
                    `}
                  >
                    {instrument}
                    {alreadyMeasured && <span className="text-sm">（測定済）</span>}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={handleCloseModal}
                className="w-full h-12 bg-gray-200 text-gray-700 rounded-lg font-bold"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
