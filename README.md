# 膜厚測定記録アプリ (film-thickness-recorder)

## 概要
塗装工事における膜厚測定データを現場で記録し、クラウド（Firebase Firestore）に保存するWebアプリ。

## 機能

### 実装済み（v1）
- **測定者・測定器の登録** - 起動時に入力、ローカル保存で次回引き継ぎ
- **測定箇所マスタ** - CSV読み込み対応
- **ルートモード** - 登録順に測定箇所を案内
- **自由選択モード** - 箇所リストから選んで測定
- **テンキーUI** - スマホで打ちやすい大きいボタン
- **5〜10点入力** - 途中削除可、平均値自動計算
- **ゲージ表示** - 狙い値に対する位置を視覚化
- **ローカル保存** - localStorageに保存、オフラインでも動く
- **クラウド送信** - Firebase Firestoreに追記（上書きなし）
- **CSV/JSONエクスポート** - ローカルデータの出力

### 未実装（TODO）
- [ ] 管理画面（データ閲覧・フィルタ・Excel出力）
- [ ] PWA対応強化（Service Worker、オフライン完全対応）
- [ ] 閾値設定画面（狙い値・上下限%の変更）
- [ ] 層の選択機能
- [ ] 位置情報でルート自動判定

---

## 技術構成

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| データ保存 | Firebase Firestore |
| ホスティング | Vercel |

---

## セットアップ

### 開発環境
```bash
npm install
npm run dev
```
http://localhost:3000 で起動

### ビルド
```bash
npm run build
```

---

## Firebase設定

### プロジェクト情報
- プロジェクト名: `film-thickness-recorder`
- プロジェクトID: `film-thickness-recorder`

### Firestore構造
```
measurements/
  ├── {auto-id}/
  │   ├── id: string (ローカル生成ID)
  │   ├── pointId: string (測定箇所ID)
  │   ├── pointName: string (測定箇所名)
  │   ├── category: string (general/extra/special/splice)
  │   ├── operator: string (測定者名)
  │   ├── instrument: string (測定器名)
  │   ├── values: number[] (測定値配列)
  │   ├── average: number (平均値)
  │   ├── timestamp: string (測定日時)
  │   └── uploadedAt: timestamp (アップロード日時)
```

### 設定ファイル
`src/lib/firebase.ts` に firebaseConfig が入っている。

---

## 測定箇所CSV形式

```csv
id,name,category,routeOrder
1,G1_主桁_①-1,general,1
2,G1_主桁_①-2,extra,2
3,対傾構_◆-1,special,3
4,添接板_◎-1,splice,4
```

### category（区分）
- `general` - 一般部
- `extra` - 増塗部
- `special` - 特殊部
- `splice` - 添接板

---

## 閾値設定（現在ハードコード）

| 区分 | 狙い値 | 下限% | 上限% |
|------|--------|-------|-------|
| 一般部 | 250μm | 70% | 130% |
| 増塗部 | 310μm | 70% | 130% |
| 特殊部 | 490μm | 70% | 130% |
| 添接板 | 300μm | 70% | 130% |

※ 後で設定画面から変更できるようにする予定

---

## デプロイ

### Vercel
1. GitHubにpush
2. Vercelでインポート
3. 自動デプロイ

### 環境変数（必要に応じて）
現在は `firebase.ts` に直書き。本番では環境変数に移行推奨：
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
...
```

---

## 画面構成

1. **セットアップ画面** - 測定者名・測定器名入力
2. **箇所リスト画面** - 測定箇所一覧、ルートモード開始ボタン
3. **測定入力画面** - テンキー、ゲージ、測定値リスト
4. **結果画面** - 測定データ一覧、クラウド送信、エクスポート

---

## 2024年12月22日 開発メモ

### 今日やったこと
- 基本UIの実装（テンキー、ゲージ、測定値リスト）
- 測定者・測定器の入力機能
- ルートモード・自由選択モード
- CSV読み込み
- Firebase Firestore連携（データ送信）

### 理解が曖昧な部分
- Vercelデプロイ時のFirebase連携の仕組み
- firebaseConfigの扱い（環境変数 vs 直書き）
- PWA化の具体的な設定

### 次にやること
- デプロイ
- 管理画面（測定者・測定器でフィルタ、Excel出力）
- 実際の200箇所のCSV作成・読み込み

---

## ファイル構成

```
film-thickness-recorder/
├── src/
│   ├── app/
│   │   ├── page.tsx          # メイン画面
│   │   ├── layout.tsx        # レイアウト
│   │   └── globals.css       # グローバルスタイル
│   ├── components/
│   │   ├── MeasurementInput.tsx  # 測定入力画面
│   │   ├── Numpad.tsx            # テンキー
│   │   ├── Gauge.tsx             # ゲージ表示
│   │   └── ValueList.tsx         # 測定値リスト
│   ├── lib/
│   │   ├── firebase.ts       # Firebase初期化
│   │   └── firestore.ts      # Firestore操作
│   └── types/
│       └── index.ts          # 型定義
├── public/
│   ├── manifest.json         # PWA設定
│   └── sample_points.csv     # サンプルCSV
└── package.json
```
