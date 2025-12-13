# 高中國文學測資料收集 DSL/DDD 設計方案

目標：設計 JSONL 格式，讓大模型能夠學習並通過 100% 高中國文學測

---

## 方案一：題目導向型 (Question-Centric)

**設計理念**：以考題為核心，完整記錄題目、選項、答案、解析

```jsonl
{
  "id": "gsat-2024-chinese-01",
  "type": "question",
  "category": "閱讀理解",
  "subcategory": "文言文",
  "source": {
    "year": 2024,
    "exam": "學測",
    "question_number": 1
  },
  "question": {
    "stem": "下列各組「」內的字，讀音相同的是...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_answer": "B",
    "difficulty": 3
  },
  "reasoning": {
    "knowledge_required": ["字音辨析", "多音字"],
    "solution_steps": ["步驟1...", "步驟2..."],
    "common_mistakes": ["容易混淆的點..."]
  },
  "related_concepts": ["字音", "形聲字"],
  "url": "https://example.com/source"
}
```

**優點**：
- 直接對應考試形式
- 容易評估模型答題能力
- 結構清晰

**缺點**：
- 知識碎片化
- 缺乏系統性知識連結
- 推理過程不夠深入

**評分：7/10**

---

## 方案二：知識圖譜型 (Knowledge Graph)

**設計理念**：建立知識體系網路，題目作為知識點的應用實例

```jsonl
{
  "id": "kg-phonetics-001",
  "type": "knowledge_node",
  "domain": "國學常識",
  "category": "字音",
  "node": {
    "name": "多音字辨析",
    "definition": "同一個字因意義或詞性不同而有不同讀音...",
    "key_points": ["破音字原則", "常見多音字列表"],
    "examples": [
      {"word": "行", "readings": [{"reading": "ㄏㄤˊ", "meaning": "行列"}, {"reading": "ㄒㄧㄥˊ", "meaning": "行走"}]}
    ]
  },
  "relations": {
    "parent": "字音學",
    "children": ["一字多音", "破音字"],
    "related": ["字形辨析", "詞義辨析"]
  },
  "applications": [
    {
      "exam_reference": "gsat-2024-chinese-01",
      "how_applied": "考查「行」字在不同語境的讀音"
    }
  ],
  "learning_path": {
    "prerequisites": ["注音符號", "聲調"],
    "next_steps": ["形近字", "同音字"]
  },
  "url": "https://example.com/source"
}
```

**優點**：
- 系統性知識架構
- 支援推理鏈
- 可追溯知識來源

**缺點**：
- 建構成本高
- 題目與知識對應複雜
- 可能過度抽象

**評分：8/10**

---

## 方案三：多維融合型 (Multi-Dimensional Fusion)

**設計理念**：結合題目、知識、推理、回答四個維度，形成完整學習閉環

```jsonl
{
  "id": "fusion-2024-001",
  "meta": {
    "source_url": "https://www.ceec.edu.tw/...",
    "source_type": "official_exam",
    "year": 2024,
    "subject": "國文",
    "exam_type": "學測",
    "created_at": "2024-01-20"
  },
  "question_layer": {
    "original_text": "閱讀下文，回答問題...",
    "question_type": "閱讀理解",
    "subtypes": ["文意判讀", "推論"],
    "options": {
      "A": {"text": "...", "is_correct": false, "trap_type": "斷章取義"},
      "B": {"text": "...", "is_correct": true, "trap_type": null},
      "C": {"text": "...", "is_correct": false, "trap_type": "過度推論"},
      "D": {"text": "...", "is_correct": false, "trap_type": "張冠李戴"}
    },
    "difficulty": {"level": 4, "discrimination": 0.65}
  },
  "knowledge_layer": {
    "domains": [
      {
        "name": "閱讀理解",
        "subtopics": ["文意理解", "推論判斷"],
        "curriculum_reference": "108課綱-A2系統思考與解決問題"
      }
    ],
    "prerequisites": ["基本文言語法", "文章結構分析"],
    "related_classics": ["論語", "孟子"],
    "vocabulary": [
      {"term": "修辭", "definition": "...", "example": "..."}
    ]
  },
  "reasoning_layer": {
    "cognitive_level": "分析",
    "thinking_process": [
      {"step": 1, "action": "閱讀題幹", "note": "確認問的是..."},
      {"step": 2, "action": "分析文本", "note": "找出關鍵句..."},
      {"step": 3, "action": "逐一檢驗選項", "note": "A選項錯在..."},
      {"step": 4, "action": "確認答案", "note": "B符合文意因為..."}
    ],
    "key_insight": "本題考查的是文意推論能力...",
    "common_errors": [
      {"error_type": "表面理解", "description": "只看字面意思忽略深層含義"}
    ]
  },
  "answer_layer": {
    "correct_answer": "B",
    "answer_rationale": "根據文中第二段...",
    "scoring_criteria": {
      "full_credit": "正確選擇B並理解原因",
      "partial_credit": null,
      "zero_credit": "選擇其他選項"
    },
    "model_response": {
      "ideal_response": "本題答案為B，因為文中明確指出...",
      "response_structure": ["定位關鍵資訊", "排除錯誤選項", "確認正確答案"]
    }
  }
}
```

**優點**：
- 四維度完整涵蓋（提問、知識、推理、回答）
- 支援深度學習與遷移
- 錯誤類型標註利於模型避錯
- 推理過程透明可追溯
- 符合 108 課綱核心素養導向

**缺點**：
- 資料標註工作量大
- 需要專業知識支援
- 格式較複雜

**評分：10/10**

---

## 最終選擇：方案三 - 多維融合型

### 選擇理由

1. **完整性**：涵蓋提問、知識體系、推理、回答四大面向
2. **可追溯性**：每個欄位都有明確來源
3. **教學價值**：推理層的思考過程可作為模型學習範本
4. **錯誤預防**：trap_type 和 common_errors 幫助模型避免常見錯誤
5. **擴展性**：可根據需要增加更多維度
6. **對齊課綱**：knowledge_layer 對應 108 課綱素養指標

### 資料收集清單 JSONL 格式

對於資源清單，採用簡化版格式：

```jsonl
{
  "id": "resource-001",
  "name": "大考中心-歷屆試題",
  "url": "https://www.ceec.edu.tw/",
  "type": "official_exam",
  "content_types": ["試題", "答案", "解析"],
  "years_covered": "1994-2024",
  "data_quality": "高",
  "access_method": "網頁下載",
  "notes": "最權威的官方來源",
  "priority": 1,
  "collected": false
}
```
