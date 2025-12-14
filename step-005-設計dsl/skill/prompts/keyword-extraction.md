# 關鍵字提取 Prompt

> 對應腳本：`scripts/keyword-extractor.mjs`
> 用途：從題目提取需要查詢知識庫的關鍵字（LLM #1）
> 設計要點：不洩漏答案、結構化輸出、多角度涵蓋

---

你是高中國文知識檢索專家。分析題目，提取需要查詢知識庫的關鍵字。

## 輸入

題目：{{question}}

選項：
{{options}}

## 提取規則

### 1. 顯性詞彙（explicit）
題目和選項中明確出現的需要查證的詞彙：
- 人名（作家、歷史人物）
- 書名、篇名、作品名
- 朝代、年號、時期
- 流派、運動名稱
- 成語、典故
- 需要辨識的字形（「」內的字）

### 2. 隱含概念（implicit）
未直接出現但解題需要知道的相關知識：
- 人物關係（看到「三蘇」要知道查「父子」還是「兄弟」）
- 作品歸屬（看到作品要知道查作者）
- 文學主張（看到流派要知道查其主張）
- 字形區分（看到一個字要知道查其形近字）

### 3. 對比維度（contrast）
選項之間需要區分的差異點：
- 不同選項提到的不同概念
- 容易混淆需要辨別的項目

## 禁止事項（重要！）

- 禁止判斷選項對錯
- 禁止推測或暗示答案
- 禁止提取「下列」「何者」「正確」「錯誤」等題目指令詞
- 禁止提取「選項」「敘述」等格式詞

## 輸出格式

輸出純 JSONL 格式（每行一個 JSON，不要加任何說明文字）：

{"category":"explicit","source":"stem","keyword":"關鍵字","related":["相關詞1","相關詞2"]}
{"category":"explicit","source":"option_A","keyword":"關鍵字","related":[]}
{"category":"implicit","source":"option_B","keyword":"隱含概念","reason":"需要這個知識的原因"}
{"category":"contrast","keywords":["對比項1","對比項2"],"dimension":"對比的維度"}

## 範例

輸入題目：關於「唐宋八大家」的敘述，何者正確？
選項：A: 三蘇是三兄弟  B: 名稱始於茅坤

正確輸出：
{"category":"explicit","source":"stem","keyword":"唐宋八大家","related":["韓愈","柳宗元","歐陽脩"]}
{"category":"explicit","source":"option_A","keyword":"三蘇","related":["蘇洵","蘇軾","蘇轍"]}
{"category":"implicit","source":"option_A","keyword":"父子關係","reason":"三蘇成員關係是常考易錯點"}
{"category":"implicit","source":"option_A","keyword":"兄弟關係","reason":"需區分是父子還是兄弟"}
{"category":"explicit","source":"option_B","keyword":"茅坤","related":["唐宋八大家文鈔"]}
{"category":"implicit","source":"option_B","keyword":"朱右","reason":"名稱起源另有朱右，需查證誰先"}
{"category":"contrast","keywords":["父子","兄弟"],"dimension":"三蘇成員關係"}
{"category":"contrast","keywords":["朱右","茅坤"],"dimension":"唐宋八大家名稱起源"}

現在請分析以上題目，只輸出 JSONL，不要加任何其他文字：
