# step-002-資料抓取

## 目錄結構

```
step-002-資料抓取/
├── raw/                    # 原始資料（完整保留不修改）
│   ├── 考題資源/           # 官方試題、模擬考、考古題
│   ├── 答案解析/           # 詳解、選擇題答案
│   ├── 作文評分/           # 國寫評分標準、佳作範本
│   ├── 課綱資料/           # 108課綱、古文15/30篇
│   ├── 知識體系/           # 辭典、文學史、古典賞析
│   ├── 閱讀寫作/           # 閱讀技巧、解題策略
│   ├── 考試資訊/           # 命題大綱、考試說明
│   └── 行動學習/           # App相關資訊
├── processed/              # 處理後的 DSL/DDD JSONL
│   ├── questions.jsonl     # 題目層
│   ├── knowledge.jsonl     # 知識層
│   ├── reasoning.jsonl     # 推理層
│   └── answers.jsonl       # 回答層
├── metadata/               # 抓取記錄（支援差異化更新）
│   └── fetch-log.jsonl     # 每次抓取的記錄
└── index/                  # 索引（方便 Agentic AI 取用）
    └── master-index.jsonl  # 總索引
```

## 檔案命名規則

### raw/ 目錄
- `{id}_{來源簡稱}_{日期}.{格式}`
- 例：`official-001_ceec_20251213.html`

### processed/ 目錄
- 使用 JSONL 格式
- 每行一筆完整記錄
- 包含 `source_id` 欄位對應原始資料

### metadata/fetch-log.jsonl
```jsonl
{"id": "official-001", "url": "...", "fetched_at": "2025-12-13T...", "status": "success", "file_path": "raw/考題資源/...", "checksum": "sha256:..."}
```

## 差異化更新機制

1. 每次抓取前檢查 `fetch-log.jsonl`
2. 比對 URL 的 Last-Modified 或 ETag
3. 只更新有變化的資源
4. 保留歷史版本（可選）

## DSL/DDD JSONL 格式

採用多維融合型（評分 10/10），包含：
- question_layer：題目、選項、陷阱類型
- knowledge_layer：知識領域、課綱對應
- reasoning_layer：推理過程、常見錯誤
- answer_layer：答案、評分標準
