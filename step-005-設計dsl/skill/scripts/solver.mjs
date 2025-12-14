/**
 * solver.mjs
 * 高中國文學測解題腳本 v3
 *
 * 採用上下文工程 (Context Engineering) + LLM 關鍵字提取
 *
 * 流程（呼叫 LLM 2 次）：
 * 1. [LLM #1] 多角度關鍵字提取（keyword-extractor.mjs）
 * 2. [rg] 平行搜尋知識庫
 * 3. [LLM #2] 解題推理
 *
 * 設計原則：BDD/TDD/SOLID/DRY
 * - 關鍵字提取與解題分離（Single Responsibility）
 * - 透過設定注入模型（Dependency Inversion）
 * - 知識庫可擴充（Open/Closed）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

// 引入關鍵字提取器
import { extractKeywords as llmExtractKeywords } from './keyword-extractor.mjs';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');
const KNOWLEDGE_DIR = join(SKILL_ROOT, 'knowledge');
const PROMPTS_DIR = join(SKILL_ROOT, 'prompts');

// 模板 ID 對應 prompt 檔案
const TEMPLATE_TO_PROMPT = {
  'T-001': 'reasoning-character.md',
  'T-002': 'reasoning-idiom.md',
  'T-003': 'reasoning-literature.md'
};

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
  timeout: 120000,
  maxTokens: 4000,
  temperature: 0.1
};

// 知識庫檔案列表
const KNOWLEDGE_FILES = [
  'character-forms.jsonl',
  'idioms.jsonl',
  'literature.jsonl',
  'rhetoric.jsonl',
  'taiwanese-literature.jsonl',
  'classical-texts.jsonl',
  'grammar.jsonl'
];

// ======================
// 平行 rg 檢索（泛化版本）
// ======================

/**
 * 執行單一 rg 檢索
 * @param {string} keyword - 搜尋關鍵字
 * @param {string} file - 檔案路徑
 * @returns {Promise<string>} 檢索結果
 */
async function rgSearch(keyword, file) {
  const filePath = join(KNOWLEDGE_DIR, file);

  if (!existsSync(filePath)) {
    return '';
  }

  try {
    // 跳過純英文或數字（如 "A", "option_A"）
    if (/^[a-zA-Z0-9_]+$/.test(keyword)) {
      return '';
    }

    // 跳過太短的關鍵字，但允許單一中文字（字形題關鍵）
    const hasChinese = /[\u4e00-\u9fff]/.test(keyword);
    if (!hasChinese && keyword.length < 2) {
      return '';
    }

    const { stdout } = await execAsync(
      `rg -C 2 -i "${keyword}" "${filePath}"`,
      { maxBuffer: 1024 * 1024 }
    );
    return stdout;
  } catch (e) {
    return '';
  }
}

/**
 * 平行執行多關鍵字檢索（泛化版本）
 * @param {Array<string>} keywords - 關鍵字陣列
 * @returns {Promise<Array<Object>>} 知識物件陣列
 */
async function parallelRgSearch(keywords) {
  const searches = [];

  // 對每個關鍵字，搜尋所有知識庫檔案
  for (const keyword of keywords) {
    for (const file of KNOWLEDGE_FILES) {
      searches.push({
        promise: rgSearch(keyword, file),
        keyword,
        file
      });
    }
  }

  // Promise.all 平行執行
  const results = await Promise.all(searches.map(s => s.promise));

  // 合併結果，去重
  const seenIds = new Set();
  const knowledge = [];

  for (const result of results) {
    if (!result) continue;

    for (const line of result.split('\n')) {
      try {
        const jsonStr = line.replace(/^\d+-/, '').replace(/^\d+:/, '');
        if (jsonStr.startsWith('{')) {
          const obj = JSON.parse(jsonStr);
          if (obj.id && !seenIds.has(obj.id)) {
            seenIds.add(obj.id);
            knowledge.push(obj);
          }
        }
      } catch (e) {
        // 非 JSON 行，忽略
      }
    }
  }

  return knowledge;
}

// ======================
// 題型識別
// ======================

function loadJsonl(relativePath) {
  const filePath = join(SKILL_ROOT, relativePath);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (e) {
    return [];
  }
}

function identifyQuestionType(questionStem, options) {
  const patterns = loadJsonl('patterns/question-types.jsonl');
  const fullText = questionStem + '\n' + options.join('\n');

  for (const pattern of patterns) {
    for (const regex of pattern.patterns) {
      if (new RegExp(regex, 'i').test(fullText)) {
        return pattern;
      }
    }
  }

  return patterns[0] || null;
}

// ======================
// Prompt 載入
// ======================

/**
 * 從 .md 檔案載入 prompt（跳過 header）
 * @param {string} filename - prompts 目錄下的檔名
 * @returns {string} prompt 內容
 */
function loadPrompt(filename) {
  const filePath = join(PROMPTS_DIR, filename);
  try {
    const content = readFileSync(filePath, 'utf-8');
    // 跳過 markdown header（--- 之前的內容）
    const parts = content.split('---');
    if (parts.length >= 3) {
      return parts.slice(2).join('---').trim();
    }
    return content.trim();
  } catch (e) {
    console.warn(`無法載入 prompt: ${filename}`);
    return null;
  }
}

// ======================
// 推理模板
// ======================

function formatKnowledge(item) {
  let text = `### ${item.topic}\n\n${item.content}`;

  if (item.key_facts) {
    text += `\n\n**重點**：${item.key_facts.join('；')}`;
  }

  if (item.common_errors) {
    text += `\n\n**常見錯誤**：${item.common_errors.join('；')}`;
  }

  return text;
}

function assembleContext(pattern, knowledge, questionStem, options) {
  // 根據模板 ID 載入對應的 prompt 檔案
  const templateId = pattern?.template_id || 'T-003';
  const promptFile = TEMPLATE_TO_PROMPT[templateId] || 'reasoning-literature.md';
  let promptTemplate = loadPrompt(promptFile);

  // 如果載入失敗，使用預設的國學常識模板
  if (!promptTemplate) {
    promptTemplate = loadPrompt('reasoning-literature.md');
  }

  const knowledgeText = knowledge.length > 0
    ? knowledge.map(k => formatKnowledge(k)).join('\n\n---\n\n')
    : '（無特定知識，請根據一般國文知識作答）';

  const optionsText = options.join('\n');

  let prompt = promptTemplate
    .replace('{{knowledge}}', knowledgeText)
    .replace('{{question}}', questionStem)
    .replace('{{options}}', optionsText);

  return prompt;
}

// ======================
// LLM API 呼叫
// ======================

async function callLLM(prompt) {
  const startTime = performance.now();

  const response = await fetch(CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/taide-botrun',
      'X-Title': 'TAIDE Botrun Skill Solver'
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens
    }),
    signal: AbortSignal.timeout(CONFIG.timeout)
  });

  const endTime = performance.now();

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage || {},
    responseTime: endTime - startTime
  };
}

// ======================
// 答案解析
// ======================

function parseAnswer(response) {
  const patterns = [
    /答案[：:]\s*([A-D])/i,
    /\*\*答案\*\*[：:]\s*([A-D])/i,
    /選擇\s*([A-D])/i,
    /正確答案[是為]?\s*([A-D])/i,
    /^([A-D])[.。\s]/m
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match) {
      return {
        answer: match[1].toUpperCase(),
        reasoning: response
      };
    }
  }

  return {
    answer: 'UNKNOWN',
    reasoning: response
  };
}

// ======================
// 主要 API
// ======================

/**
 * 解答單一題目（泛化版本）
 * 呼叫 LLM 2 次：1次提取關鍵字 + 1次解題
 */
export async function solve(question) {
  const { question_stem, options, id } = question;

  console.log(`\n[${id || 'Q'}] 開始解題...`);

  // 步驟 1: 題型識別（規則比對，不用 LLM）
  console.log('  1. 識別題型...');
  const pattern = identifyQuestionType(question_stem, options);
  console.log(`     題型: ${pattern?.description || '未知'}`);

  // 步驟 2: LLM 提取關鍵字 [LLM #1]
  console.log('  2. LLM 提取關鍵字...');
  const startExtract = performance.now();
  const extractResult = await llmExtractKeywords(question);
  const extractTime = performance.now() - startExtract;
  console.log(`     提取 ${extractResult.keywords.length} 個關鍵字 (${(extractTime / 1000).toFixed(2)}s)`);
  console.log(`     關鍵字: ${extractResult.keywords.slice(0, 8).join(', ')}${extractResult.keywords.length > 8 ? '...' : ''}`);

  // 步驟 3: 平行 rg 檢索知識庫
  console.log('  3. 平行 rg 檢索知識...');
  const startRg = performance.now();

  // Debug: 顯示要搜尋的中文關鍵字
  const chineseKeywords = extractResult.keywords.filter(kw => /[\u4e00-\u9fff]/.test(kw));
  console.log(`     搜尋 ${chineseKeywords.length} 個中文關鍵字: ${chineseKeywords.slice(0, 5).join(', ')}...`);

  const knowledge = await parallelRgSearch(chineseKeywords);
  const rgTime = performance.now() - startRg;
  console.log(`     找到 ${knowledge.length} 條相關知識 (${rgTime.toFixed(0)}ms)`);

  // 步驟 4: 組裝上下文
  console.log('  4. 組裝上下文...');
  const prompt = assembleContext(pattern, knowledge, question_stem, options);

  // 步驟 5: 呼叫 LLM 解題 [LLM #2]
  console.log('  5. LLM 解題推理...');
  const llmResponse = await callLLM(prompt);
  console.log(`     回應時間: ${(llmResponse.responseTime / 1000).toFixed(2)}s`);

  // 步驟 6: 解析答案
  const parsed = parseAnswer(llmResponse.content);
  console.log(`     答案: ${parsed.answer}`);

  return {
    questionId: id,
    answer: parsed.answer,
    reasoning: parsed.reasoning,
    pattern: pattern?.id,
    extractedKeywords: extractResult.keywords,
    knowledgeCount: knowledge.length,
    promptLength: prompt.length,
    extractTime,
    rgTime,
    responseTime: llmResponse.responseTime,
    totalTime: extractTime + rgTime + llmResponse.responseTime,
    usage: llmResponse.usage
  };
}

export async function solveBatch(questions) {
  const results = [];

  for (const question of questions) {
    try {
      const result = await solve(question);
      results.push(result);
    } catch (error) {
      console.error(`題目 ${question.id} 解題失敗:`, error.message);
      results.push({
        questionId: question.id,
        answer: 'ERROR',
        reasoning: error.message,
        error: true
      });
    }
  }

  return results;
}

// ======================
// CLI 執行
// ======================

async function main() {
  console.log('============================================');
  console.log('  高中國文學測解題系統 v3');
  console.log('  (LLM 關鍵字提取 + 平行 rg + LLM 解題)');
  console.log('============================================');

  if (!CONFIG.apiKey) {
    console.error('錯誤: 未設定 OPENROUTER_API_KEY');
    process.exit(1);
  }

  // 載入測試題目
  const questionsPath = join(SKILL_ROOT, '../../step-004-抽取5提問來訓練/data/verified-questions.jsonl');
  console.log(`\n載入題目: ${questionsPath}`);

  const questionsContent = readFileSync(questionsPath, 'utf-8');
  const questions = questionsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  console.log(`共 ${questions.length} 題\n`);

  // 解答所有題目
  const results = await solveBatch(questions);

  // 計算統計
  let correct = 0;
  let wrong = 0;
  let error = 0;

  console.log('\n============================================');
  console.log('  測試結果');
  console.log('============================================\n');

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const question = questions[i];
    const expected = question.verified_answer;
    const isCorrect = result.answer === expected;

    if (result.error) {
      error++;
      console.log(`[${i + 1}] ${result.questionId}: 錯誤 (${result.reasoning.slice(0, 50)})`);
    } else if (isCorrect) {
      correct++;
      console.log(`[${i + 1}] ${result.questionId}: ✓ 正確 (${result.answer}) | 關鍵字: ${result.extractedKeywords?.length || 0} | 知識: ${result.knowledgeCount}`);
    } else {
      wrong++;
      console.log(`[${i + 1}] ${result.questionId}: ✗ 錯誤 (答: ${result.answer}, 正確: ${expected})`);
    }
  }

  const accuracy = questions.length > 0
    ? ((correct / (questions.length - error)) * 100).toFixed(1)
    : 0;

  // 計算總時間
  const totalExtractTime = results.reduce((sum, r) => sum + (r.extractTime || 0), 0);
  const totalRgTime = results.reduce((sum, r) => sum + (r.rgTime || 0), 0);
  const totalLLMTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);

  console.log('\n============================================');
  console.log(`  統計: ${correct}/${questions.length} 正確 (${accuracy}%)`);
  console.log(`  LLM 提取: ${(totalExtractTime / 1000).toFixed(2)}s`);
  console.log(`  rg 檢索: ${(totalRgTime / 1000).toFixed(2)}s`);
  console.log(`  LLM 解題: ${(totalLLMTime / 1000).toFixed(2)}s`);
  console.log('============================================');

  // 儲存結果
  const reportPath = join(SKILL_ROOT, '../reports');
  if (!existsSync(reportPath)) {
    mkdirSync(reportPath, { recursive: true });
  }

  const reportFile = join(reportPath, 'skill-solver-result.json');
  writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: CONFIG.model,
    version: 'v3-llm-extraction',
    totalQuestions: questions.length,
    correct,
    wrong,
    error,
    accuracy: parseFloat(accuracy),
    timing: {
      totalExtractTime,
      totalRgTime,
      totalLLMTime
    },
    results
  }, null, 2));

  console.log(`\n報告已儲存: ${reportFile}`);
}

main().catch(console.error);
