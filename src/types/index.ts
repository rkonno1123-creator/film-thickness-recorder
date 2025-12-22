// 測定器
export interface Instrument {
  id: string;
  name: string; // メーカー/型番
  createdAt: Date;
}

// 現場
export interface Site {
  id: string;
  name: string; // 橋梁名等
  coatingSystem: {
    general: string; // c-3 1種
    special: string; // g-3 3種
  };
  createdAt: Date;
}

// 測定箇所
export interface MeasurementPoint {
  id: string;
  siteId: string;
  name: string; // G4_主桁_①-1
  category: 'general' | 'extra' | 'special' | 'splice'; // 一般/増塗/特殊/添接板
  routeOrder: number; // ルート順序
}

// 閾値設定
export interface Threshold {
  id: string;
  siteId: string;
  layerNumber: number; // 層番号
  category: 'general' | 'extra' | 'special' | 'splice';
  targetValue: number; // 狙い値 (μm)
  lowerLimitPercent: number; // 下限%
  upperLimitPercent: number; // 上限%
}

// 測定データ
export interface Measurement {
  id: string;
  siteId: string;
  instrumentId: string;
  pointId: string;
  layerNumber: number;
  category: 'general' | 'extra' | 'special' | 'splice';
  values: number[]; // 5〜10点の測定値
  average: number; // 平均値（自動計算）
  operator: string; // 測定者名
  measuredAt: Date;
  memo?: string;
  synced: boolean; // Firebase同期済みか
}

// 測定セッション（現在の作業状態）
export interface MeasurementSession {
  siteId: string;
  instrumentId: string;
  layerNumber: number;
  operator: string;
  currentPointIndex: number; // ルートの現在位置
}
