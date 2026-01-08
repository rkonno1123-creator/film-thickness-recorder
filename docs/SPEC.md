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
  memo?: string;        // メモ（任意）【実装済み】
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

## バー表示（ゲージ）の仕様

### 現状
- **平均値**でプロット

### 変更予定
- **入力中の値**でプロット
- 狙い値と同じ桁数になった時点で表示開始
- 例：狙い250μm（3桁）→ 3桁入力した時点でプロット
- 「追加」押す前のプレビュー的な表示
- 追加後は平均値に戻る

### 桁数
- 層によって異なる
- 最小：2桁
- 最大：3桁

---

## 画面の流れ

```
[現場選択] → [セットアップ] → [箇所リスト] → [測定入力]
     │              │               │              │
     │              │               │              └─→ 登録後：
     │              │               │                   リストに戻る（今の箇所周辺にスクロール）
     │              │               │
     │              │               ├─→ 通常モード：箇所タップ → 測定器選択（1台なら直接）→ 測定
     │              │               │
     │              │               └─→ 追加測定モード：測定済み箇所のみ表示 → 必ず測定器選択 → 測定
     │              │
     │              └─→ 測定者名、測定器選択（今日使うもの）
     │
     └─→ 前田川 上り / 前田川 下り / ...
```

---

## 追加測定モードの仕様【実装済み】

### 概要
- 通常の測定とは別に、追加で測定したい場合に使用
- 例：キャリブレーションやり直し、ダミーデータの再測定

### 動作
1. 箇所リストで「+ 追加測定」ボタンをタップ
2. 測定済みの箇所のみ表示される
3. 箇所をタップすると**必ず測定器選択モーダル**が表示（1台でも）
4. 全ての測定器から選択可能（今日選択した測定器以外も表示）
5. 測定画面にはヘッダーに「追加」バッジ表示
6. メモ欄で理由を記録可能（例：「キャリブレーションやり直し」）

### 前回データの表示（実装予定）
- 追加測定時、前回の測定データを表示
- 表示位置：入力数値の近く
- データが多い場合：スクロール対応
- ※将来的に「前回の膜厚」表示機能に統合予定

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

## ページ離脱時の確認【実装済み】

### 対象ボタン
- スキップ
- 戻る
- 終了

### 動作フロー

```
データ入力あり（1点以上）で上記ボタンを押した場合：

「○点のデータがあります。登録しますか？」
  ↓
[OK] → 5点以上なら登録して移動
     → 5点未満なら「あと○点測定してください」→ 画面にとどまる
  ↓
[キャンセル] → データを破棄して移動
```

### スキップボタンの動作【実装済み】
- **ルートモード**：次のインデックスへ移動
- **個別選択モード**：次の未測定箇所へ自動移動（全部済みならリストへ）
- 移動後は画面トップにスクロール（項目名が見える）

### 戻るボタンの動作【実装済み】
- リストに戻る
- スクロール位置を復元（元いた場所に戻る）

### 注意
- データ入力なし（0点）→ 確認なしでそのまま移動
- 5点未満では「登録して次へ」ボタンは押せない（disabled）

---

## データ管理の仕様

### ローカルストレージ
- 全測定データをブラウザのlocalStorageに保存
- iPhoneでも問題なくアクセス可能（セキュリティ制限なし）
- 「ローカルデータを削除」→ ローカルのみ削除（Firebase側は残る）

### Firebase（Firestore）
- 新しいフィールド（memo等）は自動で追加される
- 既存データに影響なし（memoが無いだけ）
- アップロード済みデータは削除されない
