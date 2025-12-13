# 索引目錄說明

此目錄包含方便 Agentic AI / LLM 快速取用的索引檔案。

## 檔案說明

### master-index.jsonl
主索引檔，每行一筆資源記錄：
```jsonl
{"id": "...", "title": "...", "category": "...", "type": "...", "path": "...", "summary": "..."}
```

### category-index/
按類別分類的索引：
- `考題資源.jsonl`
- `答案解析.jsonl`
- `作文評分.jsonl`
- `課綱資料.jsonl`
- `知識體系.jsonl`
- `閱讀寫作.jsonl`
- `考試資訊.jsonl`

## 使用方式

### 對於 Agentic AI
1. 先讀取 `master-index.jsonl` 了解可用資源
2. 根據任務需求定位相關類別
3. 讀取對應的 `processed/*.jsonl` 取得完整資料

### 查詢範例

找出所有 114 學年度的考題：
```python
# 虛擬碼
for record in master_index:
    if "114" in record["title"] and record["category"] == "考題資源":
        load(record["path"])
```

找出字音辨析相關知識：
```python
for record in knowledge_jsonl:
    if "字音" in record["knowledge_layer"]["domains"]:
        return record
```
