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
}

// セッション情報
interface SessionInfo {
  operator: string;
  instrument: string;
}

// デモ用のダミーデータ
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
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({ operator: '', instrument: '' });
  const [tempOperator, setTempOperator] = useState('');
  const [tempInstrument, setTempInstrument] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSessionInfo(session);
      setTempOperator(session.operator);
      setTempInstrument(session.instrument);
    }
  }, []);

  // 現在の測定箇所
  const currentPoint = viewMode === 'measure' && selectedPointId
    ? points.find(p => p.id === selectedPointId)
    : points[currentIndex];

  const threshold = currentPoint ? thresholds[currentPoint.category] : thresholds.general;

  // 現在のセッションで測定済みかチェック
  const isMeasured = (pointId: string) => {
    return measurements.some(m => 
      m.pointId === pointId && 
      m.operator === sessionInfo.operator && 
      m.instrument === sessionInfo.instrument
    );
  };

  // 現在のセッションの測定データを取得
  const getMeasurement = (pointId: string) => {
    return measurements.find(m => 
      m.pointId === pointId && 
      m.operator === sessionInfo.operator && 
      m.instrument === sessionInfo.instrument
    );
  };

  // 現在のセッションの測定数
  const currentSessionCount = measurements.filter(m => 
    m.operator === sessionInfo.operator && 
    m.instrument === sessionInfo.instrument
  ).length;

  // 未送信データ数
  const unsyncedCount = measurements.filter(m => !m.synced).length;

  // セッション開始
  const handleStartSession = () => {
    if (!tempOperator.trim() || !tempInstrument.trim()) return;
    
    const newSession = { operator: tempOperator.trim(), instrument: tempInstrument.trim() };
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
      
      const newPoints: MeasurementPoint[] = dataLines.map((line, index) => {
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
  const handleRegister = (values: number[]) => {
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
    };

    const newMeasurements = [...measurements, newMeasurement];
    setMeasurements(newMeasurements);
    localStorage.setItem('measurements', JSON.stringify(newMeasurements));

    // 次へ進む
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

  // 箇所を選択して測定開始
  const handleSelectPoint = (pointId: string) => {
    setSelectedPointId(pointId);
    setViewMode('measure');
  };

  // ルートモード開始
  const handleStartRoute = () => {
    setCurrentIndex(0);
    setViewMode('route');
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
    const headers = ['ID', '箇所ID', '箇所名', '区分', '測定者', '測定器', '測定値', '平均値', '測定日時', '送信済み'];
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
                測定器名
              </label>
              <input
                type="text"
                value={tempInstrument}
                onChange={(e) => setTempInstrument(e.target.value)}
                placeholder="例: 測定器A"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg text-lg"
              />
            </div>
            
            <button
              onClick={handleStartSession}
              disabled={!tempOperator.trim() || !tempInstrument.trim()}
              className={`
                w-full h-14 rounded-lg text-lg font-bold mt-4
                ${tempOperator.trim() && tempInstrument.trim()
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
                {sessionInfo.operator} / {sessionInfo.instrument}
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
              <div key={m.id} className={`p-3 rounded flex justify-between items-start ${m.synced ? 'bg-green-50' : 'bg-gray-50'}`}>
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
                </div>
                {!m.synced && (
                  <button
                    onClick={() => handleDeleteMeasurement(m.id)}
                    className="text-red-400 text-sm px-2"
                  >
                    削除
                  </button>
                )}
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
          onRegister={handleRegister}
          onSkip={handleSkip}
          onBack={handleBack}
          onFinish={handleFinish}
          canGoBack={viewMode === 'route' ? currentIndex > 0 : true}
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
            <h1 className="text-xl font-bold">膜厚測定記録</h1>
            <p className="text-sm text-gray-500">
              {sessionInfo.operator} / {sessionInfo.instrument}
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
          このセッション: {currentSessionCount} / {points.length} 箇所
          {unsyncedCount > 0 && (
            <span className="text-orange-500 ml-2">（未送信: {unsyncedCount}件）</span>
          )}
        </p>
      </header>

      <div className="p-4 space-y-2">
        <button
          onClick={handleStartRoute}
          className="w-full h-14 bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <span>▶</span> ルートモードで測定開始
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-12 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm"
          >
            CSV読込
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
          />
          
          <button
            onClick={handleFinish}
            className="flex-1 h-12 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm"
          >
            結果を見る
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-600 mb-2">測定箇所一覧</h2>
        <div className="space-y-2 max-h-[55vh] overflow-auto">
          {points.map((point) => {
            const measured = isMeasured(point.id);
            const measurement = getMeasurement(point.id);
            
            return (
              <button
                key={point.id}
                onClick={() => handleSelectPoint(point.id)}
                className={`
                  w-full p-3 rounded-lg text-left flex items-center justify-between
                  ${measured ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'}
                `}
              >
                <div>
                  <div className="font-medium">{point.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[point.category]}`}>
                      {categoryLabels[point.category]}
                    </span>
                    {measured && measurement && (
                      <span className="text-xs text-gray-500">
                        {measurement.average.toFixed(1)}μm
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {measured && (
                    <span className="text-green-500 text-xl">✓</span>
                  )}
                  <span className="text-gray-400">›</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
