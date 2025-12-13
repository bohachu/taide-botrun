# DSL/DDD JSONL 三種替代方案評比

基於 Step-004 測試結果與上下文工程 (Context Engineering) 原則，設計三種替代方案。

## 測試基準
- Gemma 3 12B IT: 40% (2/5)
- Gemini 3 Pro Preview: 60% (3/5)
- 目標：達到 100% (5/5)

---

## 方案一：規則推理庫 (Rule-Based Reasoning)

### 概念
使用 Prolog/DMN 風格的規則表示法，將國文知識編碼為邏輯規則。

### JSONL 結構
```jsonl
{"type":"rule","id":"R001","domain":"字形辨識","condition":"字根相同 AND 部首不同","conclusion":"為形近字","confidence":0.95}
{"type":"rule","id":"R002","domain":"成語","condition":"contains(成語,'罄') AND context='用盡'","conclusion":"正確用字為罄","confidence":1.0}
{"type":"fact","id":"F001","entity":"厲行","attributes":{"meaning":"嚴格執行","correct_context":"節約","common_error":"勵行"}}
```

### 優點
- 邏輯清晰，可解釋性強
- 規則可組合推理
- 符合符號推理原則

### 缺點
- 需要大量手工編碼規則
- 難以涵蓋所有情況
- 擴充性有限

### 評分
| 維度 | 分數 | 說明 |
|------|------|------|
| 簡單性 | 6 | 規則語法需學習 |
| 高效能 | 7 | 推理快速 |
| 通用規則庫 | 8 | 規則可重用 |
| 通用推理庫 | 9 | Prolog 風格推理 |
| 知識圖譜 | 5 | 結構較扁平 |
| 泛化能力 | 6 | 需要大量規則覆蓋 |
| 可解釋性 | 9 | 每步推理可追蹤 |
| BDD/TDD/SOLID | 7 | 單一職責明確 |
| **總分** | **57/80** | **7.1/10** |

---

## 方案二：知識圖譜庫 (Knowledge Graph)

### 概念
使用 Neo4j/RDF 風格的三元組，建立國文知識的關聯網絡。

### JSONL 結構
```jsonl
{"type":"node","id":"N001","label":"字","name":"厲","properties":{"部首":"厂","讀音":"ㄌㄧˋ","義項":["嚴格","猛烈"]}}
{"type":"node","id":"N002","label":"字","name":"勵","properties":{"部首":"力","讀音":"ㄌㄧˋ","義項":["勉勵","鼓勵"]}}
{"type":"edge","from":"N001","to":"N002","relation":"形近字","properties":{"混淆原因":"同音","區分方法":"厲=嚴厲,勵=鼓勵"}}
{"type":"node","id":"N003","label":"成語","name":"厲行節約","properties":{"正確字":"厲","錯誤字":"勵","解釋":"嚴格執行節約"}}
{"type":"edge","from":"N001","to":"N003","relation":"正確用字於"}
```

### 優點
- 關係豐富，可多跳推理
- 天然支援知識擴充
- GraphRAG 整合容易

### 缺點
- 結構複雜
- 查詢需要圖演算法
- 建立成本高

### 評分
| 維度 | 分數 | 說明 |
|------|------|------|
| 簡單性 | 5 | 三元組結構複雜 |
| 高效能 | 6 | 圖遍歷成本 |
| 通用規則庫 | 6 | 規則需轉換 |
| 通用推理庫 | 8 | 支援多跳推理 |
| 知識圖譜 | 10 | 原生知識圖譜 |
| 泛化能力 | 8 | 關係可推論新知 |
| 可解釋性 | 8 | 路徑可視化 |
| BDD/TDD/SOLID | 6 | 需要額外工具 |
| **總分** | **57/80** | **7.1/10** |

---

## 方案三：上下文模板庫 (Context Template)

### 概念
基於上下文工程原則，設計分層的知識模板，動態組裝最相關的上下文給 LLM。

### JSONL 結構

#### 1. 知識層 (knowledge.jsonl)
```jsonl
{"type":"knowledge","domain":"字形","topic":"厲vs勵","content":"「厲」(厂部)表嚴厲、猛烈，如厲行節約、厲害。「勵」(力部)表勉勵，如勵志、獎勵。區分口訣：嚴厲用厲，鼓勵用勵。","sources":["教育部重編國語辭典"]}
{"type":"knowledge","domain":"成語","topic":"罄竹難書","content":"「罄」(缶部)意為用盡，不可寫作「磬」(石部，樂器)。出自《呂氏春秋》。","sources":["教育部成語典"]}
{"type":"knowledge","domain":"國學","topic":"唐宋八大家","content":"唐代韓愈、柳宗元；宋代歐陽脩、蘇洵、蘇軾、蘇轍、曾鞏、王安石。三蘇為父子(洵為父)非兄弟。名稱始於明代朱右，茅坤《唐宋八大家文鈔》使之流行。","sources":["維基百科","樵客老師國文教學"]}
```

#### 2. 推理模板層 (reasoning-templates.jsonl)
```jsonl
{"type":"template","id":"T001","name":"字形辨識","pattern":"字形題","prompt_template":"## 字形辨識解題框架\n\n### 步驟一：分析每個選項的兩組字\n{{#each options}}\n- {{label}}: 分析「{{char1}}」與「{{char2}}」\n{{/each}}\n\n### 步驟二：查驗知識庫\n{{knowledge}}\n\n### 步驟三：逐項判斷\n請根據上述知識，判斷每個選項是否「字形完全正確」。\n\n### 輸出格式\n答案：[A/B/C/D]\n理由：[簡短說明]"}
{"type":"template","id":"T002","name":"成語辨識","pattern":"成語題","prompt_template":"## 成語用字辨識框架\n\n### 相關知識\n{{knowledge}}\n\n### 選項分析\n{{#each options}}\n- {{label}}: {{idiom1}} vs {{idiom2}}\n{{/each}}\n\n### 判斷標準\n1. 查驗教育部成語典標準\n2. 分析字義是否符合成語本義\n3. 辨識常見錯別字\n\n答案：[A/B/C/D]\n理由：[說明正確用字]"}
{"type":"template","id":"T003","name":"國學常識","pattern":"文學史題","prompt_template":"## 國學常識解題框架\n\n### 相關知識\n{{knowledge}}\n\n### 選項驗證\n{{#each options}}\n- {{label}}: 驗證「{{claim}}」是否正確\n{{/each}}\n\n### 常見陷阱\n- 人物關係錯誤（父子誤為兄弟）\n- 作者歸屬錯誤（曹丕誤為曹操）\n- 年代順序錯誤\n\n答案：[A/B/C/D]\n理由：[引用知識說明]"}
```

#### 3. 題型識別層 (question-patterns.jsonl)
```jsonl
{"type":"pattern","id":"P001","regex":"字形.*正確|正確.*字形","template":"T001","knowledge_domains":["字形"]}
{"type":"pattern","id":"P002","regex":"成語.*正確|用字.*正確","template":"T002","knowledge_domains":["成語"]}
{"type":"pattern","id":"P003","regex":"唐宋八大家|建安七子|竹林七賢","template":"T003","knowledge_domains":["國學"]}
```

### 工作流程
```
題目輸入 → 題型識別(patterns) → 知識檢索(knowledge) → 模板填充(templates) → LLM 推理 → 答案輸出
```

### 優點
- 結構簡單，易於理解
- 動態組裝最相關上下文
- 符合 Context Engineering 最佳實踐
- 知識與推理分離，易於維護
- 天然支援 RAG

### 缺點
- 需要設計良好的模板
- 題型識別需要維護

### 評分
| 維度 | 分數 | 說明 |
|------|------|------|
| 簡單性 | 9 | 三層結構清晰 |
| 高效能 | 9 | 直接注入上下文 |
| 通用規則庫 | 8 | 模板可重用 |
| 通用推理庫 | 8 | 模板引導推理 |
| 知識圖譜 | 7 | 可擴展為圖譜 |
| 泛化能力 | 9 | 知識+模板組合 |
| 可解釋性 | 9 | 每步驟可追蹤 |
| BDD/TDD/SOLID | 9 | 分層設計符合 SOLID |
| **總分** | **68/80** | **8.5/10** |

---

## 評分總結

| 方案 | 總分 | 評級 |
|------|------|------|
| 方案一：規則推理庫 | 57/80 | 7.1/10 |
| 方案二：知識圖譜庫 | 57/80 | 7.1/10 |
| **方案三：上下文模板庫** | **68/80** | **8.5/10** |

---

## 決策：採用方案三

### 理由
1. **最高分數 (8.5/10)**：各維度表現均衡優秀
2. **符合 Context Engineering**：動態組裝最相關上下文
3. **分層設計**：知識層、模板層、識別層職責分明 (SOLID)
4. **易於擴充**：新增知識只需加入 knowledge.jsonl
5. **可測試性**：每層可獨立測試 (TDD)
6. **LLM 友善**：直接生成結構化 prompt

### 實作計劃
1. 建立目錄結構
2. 實作 knowledge.jsonl（字形、成語、國學）
3. 實作 reasoning-templates.jsonl
4. 實作 question-patterns.jsonl
5. 實作 solver.mjs 驅動腳本
6. 測試達成 5/5 正確率
