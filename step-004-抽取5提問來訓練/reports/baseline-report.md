# OpenRouter API 模型測試報告

## 測試資訊
- 測試日期: 2025-12-13T15:57:20.851Z
- 題目數量: 5
- 測試模型: Gemma 3 12B IT, Gemini 3 Pro Preview

## 整體結果摘要

| 模型 | 正確率 | 正確/總題 | 總時間 | 平均回應 | 輸入 Token | 輸出 Token |
|------|--------|----------|--------|----------|-----------|-----------|
| Gemma 3 12B IT | 40.0% | 2/5 | 2.7s | 0.95s | 1143 | 390 |
| Gemini 3 Pro Preview | 20.0% | 1/5 | 24.9s | 4.71s | 1106 | 9054 |

## 各題詳細結果

### CH-001: 語文基礎>字形辨識

**題目**: 下列各組「」內的字，何者字形完全正確？...

**正確答案**: C

> ⚠️ **題目已修正 (2025-12-14)**：原題目 A、B、C 三項字形皆正確，造成多重正確答案問題。
> 已修正選項：A「勵行」（原「厲行」）、B「蜂湧」（原「蜂擁」），使答案唯一為 C。

| 模型 | 回答 | 正確 | 時間 |
|------|------|------|------|
| Gemma 3 12B IT | B | ✗ | 1.10s |
| Gemini 3 Pro Preview | A | ✗ | 4.75s |

### CH-003: 語文基礎>字形辨識

**題目**: 下列成語，何者用字完全正確？...

**正確答案**: D

| 模型 | 回答 | 正確 | 時間 |
|------|------|------|------|
| Gemma 3 12B IT | C | ✗ | 0.72s |
| Gemini 3 Pro Preview | A | ✗ | 4.10s |

### LK-001: 國學常識>作家作品配對

**題目**: 下列關於「唐宋八大家」的敘述，何者正確？...

**正確答案**: C

| 模型 | 回答 | 正確 | 時間 |
|------|------|------|------|
| Gemma 3 12B IT | C | ✓ | 0.85s |
| Gemini 3 Pro Preview | A | ✗ | 4.90s |

### LK-002: 國學常識>作家作品配對

**題目**: 關於「建安七子」的敘述，下列何者正確？...

**正確答案**: C

| 模型 | 回答 | 正確 | 時間 |
|------|------|------|------|
| Gemma 3 12B IT | A | ✗ | 1.16s |
| Gemini 3 Pro Preview | A | ✗ | 5.17s |

### LK-003: 國學常識>作家作品配對

**題目**: 關於「竹林七賢」，下列敘述何者錯誤？...

**正確答案**: C

| 模型 | 回答 | 正確 | 時間 |
|------|------|------|------|
| Gemma 3 12B IT | C | ✓ | 0.91s |
| Gemini 3 Pro Preview | C | ✓ | 4.60s |

## 錯誤分析

### Gemma 3 12B IT 錯誤答案

- **CH-001**: 模型答 B，正確答案 C
  - 模型推理: 理由：「蜂」和「鋒」的字形是容易混淆的，但「蜂」是蜜蜂，「鋒」是刀劍的利刃，字形結構完全不同。其他選項中，「厲」的字形有誤，「賑」和「振」的字形有誤，「弊」和「蔽」的字形有誤。
  - 可能原因: 形近字辨識錯誤，可能缺乏繁體中文字形訓練資料

- **CH-003**: 模型答 C，正確答案 D
  - 模型推理: 理由：成語的用字必須符合古字形或慣用字形。選項C的「鋌而走險」使用「鋌」字正確，表示「冒險」的意思；其他選項皆有用字錯誤，例如「磬竹難書」應為「罄竹難書」、「挺而走險」應為「鋌而走險」、「直接了當」應為「直截了當」。
  - 可能原因: 形近字辨識錯誤，可能缺乏繁體中文字形訓練資料

- **LK-002**: 模型答 A，正確答案 C
  - 模型推理: 理由：建安七子確實是孔融、陳琳、王粲、徐幹、阮瑀、應瑒、劉楨，他們是建安文學的重要代表人物，與三曹並稱。其他選項的描述有誤，例如B的說法過於誇張，C的描述不符合王粲的風格，D的描述則與史實不符。
  - 可能原因: 文學史知識錯誤，可能是訓練資料中相關知識不足或有誤

### Gemini 3 Pro Preview 錯誤答案

- **CH-001**: 模型答 A，正確答案 C
  - 模型推理: **Evaluating the Prompt's Core**

I'm focused on breaking down the initial request. My primary objective is to clarify the parameters: the role, which is a Taiwan High School Chinese Teacher, and the 
  - 可能原因: 形近字辨識錯誤，可能缺乏繁體中文字形訓練資料

- **CH-003**: 模型答 A，正確答案 D
  - 模型推理: **Evaluating the Question's Nuances**

I'm currently focusing on the specifics of the GST question, breaking down its demands to best serve the student. I'm analyzing the expected response format and 
  - 可能原因: 形近字辨識錯誤，可能缺乏繁體中文字形訓練資料

- **LK-001**: 模型答 A，正確答案 C
  - 模型推理: 理由：選項 B 的「三蘇」為父子關係（蘇洵為父）而非三兄弟；選項 C 朱右編選《八先生文集》僅確立名單，正式定名為「唐宋八大家」始於茅坤；選項 D 八大家致力於古文運動，主張復興散文並反對駢文。故僅 A 正確。
  - 可能原因: 文學史知識錯誤，可能是訓練資料中相關知識不足或有誤

- **LK-002**: 模型答 A，正確答案 C
  - 模型推理: **Examining the Request's Nuances**

I'm currently breaking down the parameters of the request. The role, task, and topic are clearly defined, which offers a great starting point. nalyzing the core re
  - 可能原因: 文學史知識錯誤，可能是訓練資料中相關知識不足或有誤

---

*報告生成時間: 2025-12-13T15:57:20.851Z*
