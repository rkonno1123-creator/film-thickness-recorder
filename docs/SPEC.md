# 仕様書

## データ構造

### 測定箇所（CSVから読み込み）

```typescript
interface MeasurementPoint {
  id: string;           // 箇所ID（例: "1", "2"）
  name: string;         // 箇所名（例: "G1_主桁_①-1"）
  category: string;     // 区分（general/extra/special/splice）
  routeOrder: number;   // 測定順
}
```

### 測定データ（ローカル保存 & Firebase送信）

```typescript
interface SavedMeasurement {
  id: string;           // ユニークID
  pointId: string;      // 箇所ID
  pointName: string;    // 箇所名
  category: string;     // 区分
  operator: string;     // 測定者
  instrument: string;   // 測定器（Pro-W, LZ990, Elcometer）
  values: number[];     // 測定値（5〜10点）
  average: number;      // 平均値
  timestamp: string;    // 測定日時
  synced: boolean;      // 送信済みか
  memo?: string;        // メモ（任意）← 追加予定
  layer?: number;       // 層番号 ← 追加予定
  siteId?: string;      // 現場ID ← 追加予定
  siteName?: string;    // 現場名 ← 追加予定
}
```

---

## 区分と閾値

| category | 表示名 | 狙い値 | 下限% | 上限% |
|----------|--------|--------|-------|-------|
| general  | 一般部 | 255μm  | 80%   | 150%  |
| extra    | 増塗部 | 340μm  | 80%   | 150%  |
| special  | 特殊部 | 170μm  | 80%   | 150%  |
| splice   | 添接板 | 340μm  | 80%   | 150%  |

---

## ビジネスロジック

### 測定値の制約
- 最小: 5点（**5点未満は登録不可**）
- 最大: 10点
- 入力値: 1〜9999（4桁まで）

### 測定完了の判定
セットアップで選択した**全ての測定器**で測定完了 → その箇所は「完了」

### 閾値による判定

```typescript
const lowerLimit = targetValue * (lowerLimitPercent / 100);
const upperLimit = targetValue * (upperLimitPercent / 100);

if (average >= lowerLimit && average <= upperLimit) {
  // 適正（緑）
} else if (average < lowerLimit) {
  // 低い（青）
} else {
  // 高い（赤）
}
```

### 測定データの保存
- 同じ箇所・測定者・測定器でも**常に追加**（上書きしない）
- ユニークID: タイムスタンプベースで生成

### クラウド送信
- `synced: false` のデータのみ送信
- 成功後 → `synced: true` に更新
- 送信済みデータは削除・変更不可

---

## 画面の流れ

```
[現場選択] → [セットアップ] → [箇所リスト] → [測定入力]
     │              │               │              │
     │              │               │              └─→ 登録後：
     │              │               │                   1機種 → リストに戻る（周辺にスクロール）
     │              │               │                   複数 → 「別測定器」or「リストに戻る」選択
     │              │               │
     │              │               └─→ 追加測定ボタン → 箇所選択 → 測定（メモ入力あり）
     │              │
     │              └─→ 測定者名、測定器選択（今日使うもの）
     │
     └─→ 前田川 上り / 前田川 下り / ...
```

---

## ローカルストレージ

| キー | 内容 |
|------|------|
| `film-thickness-measurements` | 測定データの配列 |
| `film-thickness-session` | セッション情報（測定者、測定器、現場） |

---

## Firebase構造

### 現在
```
measurements/{auto-id}/
  - pointId: string
  - pointName: string
  - category: string
  - operator: string
  - instrument: string
  - values: number[]
  - average: number
  - timestamp: Timestamp
```

### 将来（検討中）
```
sites/{siteId}/
  - name: string
  - createdAt: Timestamp

measurements/{siteId}/{measurementId}/
  - pointId: string
  - layer: number        ← 層番号
  - memo: string         ← メモ
  - ...
```

---

## スキップボタンの仕様（修正予定）

### 現状の問題
- 戻るボタンと挙動が同じ

### 修正後の仕様
1. スキップ押す → データを保存せずに次の箇所へ
2. 5点未満で「登録」押す → 「最低5点記録してください」と表示
3. スキップは5点未満でもOK（データは保存しない）
