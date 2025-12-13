/**
 * solver.mjs
 * 高中國文學測解題腳本 v2
 *
 * 採用上下文工程 (Context Engineering) + Promise.all 平行 rg 檢索
 *
 * 知識檢索策略：
 * - 從題目選項提取多組關鍵字
 * - 對每個知識檔案、每組關鍵字執行 rg -C 平行檢索
 * - 結果去重 + 按相關性排序
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(__dirname, '..');
const KNOWLEDGE_DIR = join(SKILL_ROOT, 'knowledge');

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

// ======================
// 關鍵字提取
// ======================

/**
 * 從題目提取多組關鍵字
 * @param {string} questionStem - 題幹
 * @param {Array<string>} options - 選項
 * @returns {Array<{keywords: string[], file: string}>} 關鍵字群組
 */
function extractKeywords(questionStem, options) {
  const groups = [];
  const fullText = questionStem + '\n' + options.join('\n');

  // 國學常識關鍵字
  const literatureKeywords = [
    '唐宋八大家', '三蘇', '韓愈', '柳宗元', '歐陽脩', '蘇洵', '蘇軾', '蘇轍',
    '建安七子', '三曹', '王粲', '曹丕', '曹操', '典論',
    '竹林七賢', '阮籍', '嵇康', '山濤', '向秀', '劉伶', '王戎', '阮咸'
  ];

  const matchedLiterature = literatureKeywords.filter(kw => fullText.includes(kw));
  if (matchedLiterature.length > 0) {
    groups.push({ keywords: matchedLiterature, file: 'literature.jsonl' });
  }

  // 成語關鍵字
  const idiomKeywords = [
    '罄竹難書', '磬竹難書', '貌合神離', '貌和神離',
    '鋌而走險', '挺而走險', '直截了當', '直接了當',
    '成語', '用字'
  ];

  const matchedIdiom = idiomKeywords.filter(kw => fullText.includes(kw));
  if (matchedIdiom.length > 0) {
    groups.push({ keywords: matchedIdiom, file: 'idioms.jsonl' });
  }

  // 字形關鍵字 - 從「」內提取
  const charMatches = fullText.match(/「([^」])」/g) || [];
  const chars = charMatches.map(m => m.replace(/[「」]/g, ''));

  // 常見形近字組
  const charPairs = [
    ['厲', '勵'], ['蜂', '鋒'], ['擁', '湧'], ['賑', '振'],
    ['弊', '蔽'], ['罄', '磬'], ['合', '和'], ['鋌', '挺'], ['截', '接']
  ];

  const matchedChars = [];
  for (const pair of charPairs) {
    if (pair.some(c => fullText.includes(c))) {
      matchedChars.push(...pair);
    }
  }

  if (matchedChars.length > 0 || chars.length > 0) {
    groups.push({
      keywords: [...new Set([...matchedChars, ...chars])],
      file: 'character-forms.jsonl'
    });
  }

  // 如果沒有匹配到任何關鍵字，對所有檔案搜尋
  if (groups.length === 0) {
    // 提取所有中文字詞作為關鍵字
    const allChineseWords = fullText.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    const uniqueWords = [...new Set(allChineseWords)].slice(0, 10);

    groups.push({ keywords: uniqueWords, file: 'character-forms.jsonl' });
    groups.push({ keywords: uniqueWords, file: 'idioms.jsonl' });
    groups.push({ keywords: uniqueWords, file: 'literature.jsonl' });
  }

  return groups;
}

// ======================
// 平行 rg 檢索
// ======================

/**
 * 執行單一 rg 檢索
 * @param {string} pattern - 搜尋模式
 * @param {string} file - 檔案路徑
 * @returns {Promise<string>} 檢索結果
 */
async function rgSearch(pattern, file) {
  const filePath = join(KNOWLEDGE_DIR, file);

  if (!existsSync(filePath)) {
    return '';
  }

  try {
    // 使用 rg -C 3 保留上下文，-i 不區分大小寫
    const { stdout } = await execAsync(
      `rg -C 3 -i "${pattern}" "${filePath}"`,
      { maxBuffer: 1024 * 1024 }
    );
    return stdout;
  } catch (e) {
    // rg 找不到匹配時會回傳非零 exit code
    return '';
  }
}

/**
 * 平行執行多組 rg 檢索
 * @param {Array<{keywords: string[], file: string}>} groups - 關鍵字群組
 * @returns {Promise<Map<string, Set<string>>>} 檔案 -> 匹配行集合
 */
async function parallelRgSearch(groups) {
  const searches = [];

  for (const group of groups) {
    for (const keyword of group.keywords) {
      searches.push({
        promise: rgSearch(keyword, group.file),
        file: group.file,
        keyword
      });
    }
  }

  // Promise.all 平行執行所有搜尋
  const results = await Promise.all(searches.map(s => s.promise));

  // 合併結果，按檔案分組
  const fileResults = new Map();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const file = searches[i].file;

    if (result) {
      if (!fileResults.has(file)) {
        fileResults.set(file, new Set());
      }
      // 將結果行加入集合（自動去重）
      result.split('\n').forEach(line => {
        if (line.trim()) {
          fileResults.get(file).add(line);
        }
      });
    }
  }

  return fileResults;
}

/**
 * 從 rg 結果解析 JSONL 物件
 * @param {Map<string, Set<string>>} fileResults - rg 結果
 * @returns {Array<Object>} 知識物件陣列
 */
function parseRgResults(fileResults) {
  const knowledge = [];
  const seenIds = new Set();

  for (const [file, lines] of fileResults) {
    for (const line of lines) {
      // 嘗試解析 JSON
      try {
        // rg 結果可能包含行號前綴，先移除
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
// 層級 1: 題型識別
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
// 層級 2: 知識檢索（使用平行 rg）
// ======================

/**
 * 檢索相關知識（使用 Promise.all + rg）
 */
async function retrieveKnowledge(pattern, questionStem, options) {
  // 提取關鍵字群組
  const keywordGroups = extractKeywords(questionStem, options);

  console.log(`     關鍵字群組: ${keywordGroups.map(g => `[${g.file}: ${g.keywords.slice(0, 3).join(', ')}...]`).join(' ')}`);

  // 平行 rg 檢索
  const fileResults = await parallelRgSearch(keywordGroups);

  // 解析結果
  const knowledge = parseRgResults(fileResults);

  return knowledge;
}

// ======================
// 層級 3: 推理模板
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
  const templates = loadJsonl('templates/reasoning.jsonl');
  const template = templates.find(t => t.id === pattern?.template_id) || templates[0];

  // 格式化知識
  const knowledgeText = knowledge.length > 0
    ? knowledge.map(k => formatKnowledge(k)).join('\n\n---\n\n')
    : '（無特定知識，請根據一般國文知識作答）';

  // 格式化選項
  const optionsText = options.join('\n');

  // 替換模板變數
  let prompt = template.prompt_template
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

export async function solve(question) {
  const { question_stem, options, id } = question;

  console.log(`\n[${id || 'Q'}] 開始解題...`);

  // 步驟 1: 題型識別
  console.log('  1. 識別題型...');
  const pattern = identifyQuestionType(question_stem, options);
  console.log(`     題型: ${pattern?.description || '未知'}`);

  // 步驟 2: 知識檢索（平行 rg）
  console.log('  2. 平行 rg 檢索知識...');
  const startRg = performance.now();
  const knowledge = await retrieveKnowledge(pattern, question_stem, options);
  const rgTime = performance.now() - startRg;
  console.log(`     找到 ${knowledge.length} 條相關知識 (${rgTime.toFixed(0)}ms)`);

  // 步驟 3: 組裝上下文
  console.log('  3. 組裝上下文...');
  const prompt = assembleContext(pattern, knowledge, question_stem, options);

  // 步驟 4: 呼叫 LLM
  console.log('  4. 呼叫 LLM...');
  const llmResponse = await callLLM(prompt);
  console.log(`     回應時間: ${(llmResponse.responseTime / 1000).toFixed(2)}s`);

  // 步驟 5: 解析答案
  const parsed = parseAnswer(llmResponse.content);
  console.log(`     答案: ${parsed.answer}`);

  return {
    questionId: id,
    answer: parsed.answer,
    reasoning: parsed.reasoning,
    pattern: pattern?.id,
    knowledgeCount: knowledge.length,
    promptLength: prompt.length,
    rgTime,
    responseTime: llmResponse.responseTime,
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
  console.log('  高中國文學測解題系統 v2');
  console.log('  (Context Engineering + 平行 rg 檢索)');
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
      console.log(`[${i + 1}] ${result.questionId}: ✓ 正確 (${result.answer})`);
    } else {
      wrong++;
      console.log(`[${i + 1}] ${result.questionId}: ✗ 錯誤 (答: ${result.answer}, 正確: ${expected})`);
    }
  }

  const accuracy = questions.length > 0
    ? ((correct / (questions.length - error)) * 100).toFixed(1)
    : 0;

  console.log('\n============================================');
  console.log(`  統計: ${correct}/${questions.length} 正確 (${accuracy}%)`);
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
    totalQuestions: questions.length,
    correct,
    wrong,
    error,
    accuracy: parseFloat(accuracy),
    results
  }, null, 2));

  console.log(`\n報告已儲存: ${reportFile}`);
}

main().catch(console.error);
