# 現場の追加方法

## 1. CSVを作る

```csv
id,name,category,routeOrder
1,G1_主桁_①-1,general,1
2,G1_主桁_①-2,extra,2
3,G1_主桁_②-1,general,3
```

### category の種類

| category | 意味 | 狙い値 |
|----------|------|--------|
| general  | 一般部 | 255μm |
| extra    | 増塗部 | 340μm |
| special  | 特殊部 | 170μm |
| splice   | 添接板 | 340μm |

## 2. ファイルを置く

```
public/sites/現場名.csv
```

## 3. コードに追加

`src/app/page.tsx` を開いて、`SITES` を探す：

```typescript
const SITES = [
  { id: 'maedagawa-nobori', name: '前田川 上り', file: '/sites/maedagawa-nobori.csv' },
  { id: 'new-site', name: '新しい現場', file: '/sites/new-site.csv' },  // ← 追加
] as const;
```

## 4. デプロイ

```bash
git add .
git commit -m "現場追加"
git push
```
