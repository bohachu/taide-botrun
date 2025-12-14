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
const PROMPTS_DIR = join(SKILL_ROOT, 'prompts');

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
// Prompt 模板載入
// ======================

/**
 * 從 .md 檔案載入 prompt（跳過 header）
 * @param {string} filename - prompts 目錄下的檔名
 * @returns {string} prompt 內容
 */
function loadPrompt(filename) {
  const filePath = join(PROMPTS_DIR, filename);
  const content = readFileSync(filePath, 'utf-8');

  // 跳過 markdown header（--- 之前的內容）
  const parts = content.split('---');
  if (parts.length >= 3) {
    // 格式：header --- metadata --- content
    return parts.slice(2).join('---').trim();
  }
  return content.trim();
}

/**
 * 多角度關鍵字提取 Prompt
 * 設計要點：
 * 1. 不洩漏答案（禁止判斷對錯）
 * 2. 結構化輸出（JSONL）
 * 3. 多角度涵蓋（顯性+隱含+對比）
 *
 * 來源：prompts/keyword-extraction.md
 */
const EXTRACTION_PROMPT = loadPrompt('keyword-extraction.md');

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
