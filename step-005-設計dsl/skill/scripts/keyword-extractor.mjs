/**
 * keyword-extractor.mjs
 * 多角度關鍵字提取器
 *
 * 設計原則：
 * - Single Responsibility: 只負責提取關鍵字，不負責解題
 * - Open/Closed: 透過 prompt 調整策略，不修改程式碼
 * - Dependency Inversion: 透過設定注入 LLM 配置
 *
 * 提取策略（多角度單次提取）：
 * 1. 顯性詞彙：題目中明確出現的專有名詞
 * 2. 隱含概念：需要查證但未直接出現的相關知識
 * 3. 對比維度：選項之間容易混淆的對比點
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');

// ======================
// 載入環境變數
// ======================
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    // 忽略
  }
}

loadEnv(join(SKILL_ROOT, '../../../.env'));

// ======================
// 設定
// ======================
const CONFIG = {
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemma-3-12b-it',
  timeout: 60000,
  maxTokens: 2000,
  temperature: 0.1
};

// ======================
// Prompt 模板
// ======================

/**
 * 多角度關鍵字提取 Prompt
 * 設計要點：
 * 1. 不洩漏答案（禁止判斷對錯）
 * 2. 結構化輸出（JSONL）
 * 3. 多角度涵蓋（顯性+隱含+對比）
 */
const EXTRACTION_PROMPT = `你是高中國文知識檢索專家。分析題目，提取需要查詢知識庫的關鍵字。

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

現在請分析以上題目，只輸出 JSONL，不要加任何其他文字：`;

// ======================
// LLM API 呼叫
// ======================

/**
 * 呼叫 LLM 提取關鍵字
 * @param {string} prompt - 組裝好的 prompt
 * @returns {Promise<string>} LLM 回應
 */
async function callLLM(prompt) {
  const response = await fetch(CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/taide-botrun',
      'X-Title': 'TAIDE Keyword Extractor'
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens
    }),
    signal: AbortSignal.timeout(CONFIG.timeout)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ======================
// JSONL 解析
// ======================

/**
 * 解析 LLM 輸出的 JSONL
 * @param {string} output - LLM 輸出
 * @returns {Array<Object>} 解析後的關鍵字物件陣列
 */
function parseJsonlOutput(output) {
  const results = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) {
      continue;
    }

    try {
      const obj = JSON.parse(trimmed);
      // 驗證必要欄位
      if (obj.category && (obj.keyword || obj.keywords)) {
        results.push(obj);
      }
    } catch (e) {
      // 解析失敗，跳過這行
      console.warn(`JSONL 解析失敗: ${trimmed.slice(0, 50)}...`);
    }
  }

  return results;
}

/**
 * 從提取結果中取得所有關鍵字（扁平化）
 * @param {Array<Object>} extracted - 提取結果
 * @returns {Array<string>} 關鍵字陣列
 */
function flattenKeywords(extracted) {
  const keywords = new Set();

  for (const item of extracted) {
    // 單一關鍵字
    if (item.keyword) {
      keywords.add(item.keyword);
    }

    // 多個關鍵字（對比類型）
    if (item.keywords && Array.isArray(item.keywords)) {
      item.keywords.forEach(kw => keywords.add(kw));
    }

    // 相關詞
    if (item.related && Array.isArray(item.related)) {
      item.related.forEach(kw => keywords.add(kw));
    }
  }

  return [...keywords];
}

// ======================
// 主要 API
// ======================

/**
 * 從題目提取關鍵字
 * @param {Object} question - 題目物件
 * @returns {Promise<Object>} 提取結果
 */
export async function extractKeywords(question) {
  const { question_stem, options, id } = question;

  // 組裝 prompt
  const optionsText = options.map((opt, i) => {
    const label = String.fromCharCode(65 + i); // A, B, C, D
    return `${label}: ${opt.replace(/^[A-D]:\s*/, '')}`;
  }).join('\n');

  const prompt = EXTRACTION_PROMPT
    .replace('{{question}}', question_stem)
    .replace('{{options}}', optionsText);

  // 呼叫 LLM
  const startTime = performance.now();
  const output = await callLLM(prompt);
  const responseTime = performance.now() - startTime;

  // 解析 JSONL
  const extracted = parseJsonlOutput(output);
  const keywords = flattenKeywords(extracted);

  return {
    questionId: id,
    extracted,           // 結構化的提取結果
    keywords,            // 扁平化的關鍵字列表
    rawOutput: output,   // 原始 LLM 輸出（用於除錯）
    responseTime
  };
}

/**
 * 批次提取關鍵字
 * @param {Array<Object>} questions - 題目陣列
 * @returns {Promise<Array<Object>>} 提取結果陣列
 */
export async function extractKeywordsBatch(questions) {
  const results = [];

  for (const question of questions) {
    try {
      const result = await extractKeywords(question);
      results.push(result);
    } catch (error) {
      console.error(`題目 ${question.id} 提取失敗:`, error.message);
      results.push({
        questionId: question.id,
        extracted: [],
        keywords: [],
        error: error.message
      });
    }
  }

  return results;
}

// ======================
// CLI 執行（測試用）
// ======================

async function main() {
  console.log('============================================');
  console.log('  關鍵字提取器測試');
  console.log('  (多角度單次提取 + JSONL 輸出)');
  console.log('============================================');

  if (!CONFIG.apiKey) {
    console.error('錯誤: 未設定 OPENROUTER_API_KEY');
    process.exit(1);
  }

  // 測試題目
  const testQuestion = {
    id: 'TEST-001',
    question_stem: '下列關於「唐宋八大家」的敘述，何者正確？',
    options: [
      'A: 唐代二家為韓愈、柳宗元，宋代六家為歐陽脩、三蘇、王安石、曾鞏',
      'B: 「三蘇」指蘇洵、蘇軾、蘇轍三兄弟，人稱「一門三學士」',
      'C: 此名稱始於明代朱右《八先生文集》，明末茅坤《唐宋八大家文鈔》使之流行',
      'D: 八大家皆以駢文見長，反對散文，影響後世文壇甚鉅'
    ]
  };

  console.log('\n測試題目:', testQuestion.question_stem);
  console.log('選項:', testQuestion.options.join('\n       '));

  console.log('\n提取中...');
  const result = await extractKeywords(testQuestion);

  console.log(`\n提取耗時: ${(result.responseTime / 1000).toFixed(2)}s`);
  console.log(`提取到 ${result.extracted.length} 個結構化項目`);
  console.log(`扁平化關鍵字 ${result.keywords.length} 個\n`);

  console.log('=== 結構化結果（JSONL）===');
  for (const item of result.extracted) {
    console.log(JSON.stringify(item));
  }

  console.log('\n=== 扁平化關鍵字 ===');
  console.log(result.keywords.join(', '));
}

// 執行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
